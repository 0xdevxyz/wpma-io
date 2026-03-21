<?php
/**
 * WPMA Backup Handler
 * Erstellt echte Backups der WordPress-Site und lädt sie zu S3/iDrive e2 hoch
 */

if (!defined('ABSPATH')) exit;
if (class_exists('WPMA_Backup')) return;

class WPMA_Backup {
    
    private $backup_dir;
    private $max_execution_time = 300; // 5 Minuten
    
    public function __construct() {
        $this->backup_dir = WP_CONTENT_DIR . '/wpma-backups';
        $this->ensure_backup_dir();
    }
    
    public function init() {
        // REST API Endpoints
        add_action('rest_api_init', array($this, 'register_rest_routes'));

        // AJAX Handler für Admin
        add_action('wp_ajax_wpma_create_backup', array($this, 'ajax_create_backup'));
        add_action('wp_ajax_wpma_get_backup_status', array($this, 'ajax_get_backup_status'));

        // Async Cron-Hooks: Backup + Restore ohne HTTP-Timeout
        add_action('wpma_run_backup_async',  array($this, 'run_backup_async'),  10, 5);
        add_action('wpma_run_restore_async', array($this, 'run_restore_async'), 10, 3);
    }

    public function run_backup_async( $backup_type, $backup_id, $provider, $bucket, $credentials ) {
        $this->create_backup($backup_type, $backup_id, $provider, $bucket, $credentials);
    }
    
    /**
     * Registriert REST API Routen
     */
    public function register_rest_routes() {
        register_rest_route('wpma/v1', '/backup/create', array(
            'methods' => 'POST',
            'callback' => array($this, 'rest_create_backup'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));

        register_rest_route('wpma/v1', '/backup/status/(?P<backup_id>[a-zA-Z0-9_-]+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'rest_get_backup_status'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));

        register_rest_route('wpma/v1', '/backup/restore', array(
            'methods' => 'POST',
            'callback' => array($this, 'rest_restore_backup'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));

        register_rest_route('wpma/v1', '/backup/restore-status/(?P<restore_id>[a-zA-Z0-9_-]+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'rest_get_restore_status'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));
    }
    
    /**
     * Verifiziert den API-Key
     */
    public function verify_api_key($request) {
        $api_key = $request->get_header('X-WPMA-API-Key');
        $stored_key = get_option('wpma_api_key', '');
        
        return !empty($api_key) && $api_key === $stored_key;
    }
    
    /**
     * REST: Erstellt Backup
     */
    public function rest_create_backup($request) {
        $params = $request->get_json_params();

        $backup_type = isset($params['backup_type']) ? $params['backup_type'] : 'full';
        $backup_id   = isset($params['backup_id'])   ? $params['backup_id']   : $this->generate_backup_id();
        $provider    = isset($params['provider'])    ? $params['provider']    : 'local';
        $bucket      = isset($params['bucket'])      ? $params['bucket']      : '';
        $credentials = isset($params['upload_credentials']) ? $params['upload_credentials'] : array();

        // Site-Größe berechnen für Zeit-Schätzung
        $size_bytes    = $this->get_content_dir_size();
        $size_mb       = round($size_bytes / 1048576, 1);
        $estimated_sec = $this->estimate_backup_seconds($size_bytes, $provider, $credentials);
        $estimated_min = max(1, ceil($estimated_sec / 60));

        // Status sofort auf 'pending' setzen
        set_transient('wpma_backup_status_' . $backup_id, array(
            'backup_id'     => $backup_id,
            'status'        => 'pending',
            'progress'      => 0,
            'size_mb'       => $size_mb,
            'estimated_min' => $estimated_min,
        ), HOUR_IN_SECONDS);

        // WP-Cron führt das eigentliche Backup asynchron aus → kein Timeout
        wp_schedule_single_event(time(), 'wpma_run_backup_async', array(
            $backup_type, $backup_id, $provider, $bucket, $credentials
        ));
        spawn_cron();

        return rest_ensure_response(array(
            'success'       => true,
            'backup_id'     => $backup_id,
            'status'        => 'pending',
            'size_mb'       => $size_mb,
            'estimated_min' => $estimated_min,
            'message'       => "Backup gestartet (~{$estimated_min} Min.)",
        ));
    }
    
    /**
     * REST: Holt Backup-Status
     */
    public function rest_get_backup_status($request) {
        $backup_id = $request->get_param('backup_id');
        $status = get_transient('wpma_backup_status_' . $backup_id);
        
        if (!$status) {
            return new WP_Error('not_found', 'Backup nicht gefunden', array('status' => 404));
        }
        
        return rest_ensure_response($status);
    }
    
    /**
     * AJAX: Erstellt Backup aus Admin
     */
    public function ajax_create_backup() {
        check_ajax_referer('wpma_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Keine Berechtigung');
        }
        
        $backup_type = isset($_POST['backup_type']) ? sanitize_text_field($_POST['backup_type']) : 'full';
        $backup_id = $this->generate_backup_id();
        
        // Hole Credentials vom Backend
        $credentials = $this->get_backup_credentials();
        
        $result = $this->create_backup($backup_type, $backup_id, 'idrive_e2', '', $credentials);
        
        wp_send_json($result);
    }
    
    /**
     * Hauptmethode: Erstellt Backup
     */
    public function create_backup($backup_type, $backup_id, $provider, $bucket, $credentials) {
        // Erhöhe Limits
        @set_time_limit($this->max_execution_time);
        @ini_set('memory_limit', '512M');
        
        $this->update_backup_status($backup_id, 'starting', 'Backup wird gestartet...');
        
        try {
            $backup_file = $this->backup_dir . '/' . $backup_id . '.zip';
            
            // Erstelle ZIP-Archiv
            $zip = new ZipArchive();
            if ($zip->open($backup_file, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== TRUE) {
                throw new Exception('Konnte ZIP-Archiv nicht erstellen');
            }
            
            // Je nach Backup-Typ
            if ($backup_type === 'full' || $backup_type === 'files') {
                $this->update_backup_status($backup_id, 'archiving_files', 'Archiviere WordPress-Dateien...');
                $this->add_wordpress_files($zip, $backup_id);
            }
            
            if ($backup_type === 'full' || $backup_type === 'database') {
                $this->update_backup_status($backup_id, 'dumping_database', 'Erstelle Datenbank-Dump...');
                $this->add_database_dump($zip, $backup_id);
            }
            
            // Füge Manifest hinzu
            $this->add_manifest($zip, $backup_type, $backup_id);
            
            $zip->close();
            
            // Hole Dateigröße
            $file_size = filesize($backup_file);
            
            // Upload zu S3/iDrive wenn Credentials vorhanden
            $s3_url = null;
            if (!empty($credentials) && $provider !== 'local') {
                $this->update_backup_status($backup_id, 'uploading', 'Lade Backup hoch...');
                $s3_url = $this->upload_to_s3($backup_file, $backup_id, $credentials, $bucket);
                
                // Lösche lokale Datei nach Upload
                if ($s3_url) {
                    @unlink($backup_file);
                }
            }
            
            $this->update_backup_status($backup_id, 'completed', 'Backup erfolgreich erstellt!');
            
            // Log
            $this->log_backup($backup_id, $backup_type, $file_size, $s3_url);
            
            return array(
                'success' => true,
                'backup_id' => $backup_id,
                'backup_type' => $backup_type,
                'file_size' => $file_size,
                's3_url' => $s3_url,
                'local_path' => $s3_url ? null : $backup_file
            );
            
        } catch (Exception $e) {
            $this->update_backup_status($backup_id, 'failed', 'Fehler: ' . $e->getMessage());
            
            // Cleanup
            if (file_exists($backup_file)) {
                @unlink($backup_file);
            }
            
            return array(
                'success' => false,
                'error' => $e->getMessage()
            );
        }
    }
    
    /**
     * Fügt nur wichtige WordPress-Dateien zum ZIP hinzu
     * (wp-content + wp-config.php - WordPress Core kann neu installiert werden)
     */
    private function add_wordpress_files($zip, $backup_id) {
        $wp_root = ABSPATH;
        $wp_content = WP_CONTENT_DIR;
        
        // Ausschlüsse innerhalb von wp-content
        $exclude = array(
            'cache',
            'wpma-backups',
            'upgrade',
            'uploads/cache',
            'uploads/wpcf7_uploads',
            'debug.log',
            'advanced-cache.php',
            'object-cache.php'
        );
        
        $files_added = 0;
        
        // 1. wp-config.php sichern (wichtig!)
        $wp_config = $wp_root . 'wp-config.php';
        if (file_exists($wp_config)) {
            $zip->addFile($wp_config, 'wp-config.php');
            $files_added++;
        }
        
        // 2. .htaccess sichern (falls vorhanden)
        $htaccess = $wp_root . '.htaccess';
        if (file_exists($htaccess)) {
            $zip->addFile($htaccess, '.htaccess');
            $files_added++;
        }
        
        // 3. Nur wp-content Verzeichnis sichern
        $this->update_backup_status($backup_id, 'archiving_files', 'Archiviere wp-content...');
        
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($wp_content, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );
        
        foreach ($iterator as $file) {
            $file_path = $file->getRealPath();
            $relative_path = substr($file_path, strlen($wp_content) + 1);
            
            // Prüfe Ausschlüsse
            $skip = false;
            foreach ($exclude as $excluded) {
                if (strpos($relative_path, $excluded) === 0 || strpos($relative_path, '/' . $excluded) !== false) {
                    $skip = true;
                    break;
                }
            }
            
            if ($skip) continue;
            
            if ($file->isDir()) {
                $zip->addEmptyDir('wp-content/' . $relative_path);
            } else {
                // Überspringe sehr große Dateien (>50MB einzeln)
                if ($file->getSize() > 50 * 1024 * 1024) {
                    continue;
                }
                
                $zip->addFile($file_path, 'wp-content/' . $relative_path);
                $files_added++;
                
                // Update Status alle 50 Dateien
                if ($files_added % 50 === 0) {
                    $this->update_backup_status($backup_id, 'archiving_files', "Archiviere wp-content... ($files_added Dateien)");
                }
            }
        }
        
        $this->update_backup_status($backup_id, 'archiving_files', "Archivierung abgeschlossen ($files_added Dateien)");
    }
    
    /**
     * Fügt Datenbank-Dump zum ZIP hinzu
     */
    private function add_database_dump($zip, $backup_id) {
        global $wpdb;
        
        $dump_file = $this->backup_dir . '/db_' . $backup_id . '.sql';
        $handle = fopen($dump_file, 'w');
        
        if (!$handle) {
            throw new Exception('Konnte Dump-Datei nicht erstellen');
        }
        
        // Header
        fwrite($handle, "-- WPMA Database Backup\n");
        fwrite($handle, "-- Generated: " . date('Y-m-d H:i:s') . "\n");
        fwrite($handle, "-- WordPress Version: " . get_bloginfo('version') . "\n");
        fwrite($handle, "-- Site: " . get_bloginfo('url') . "\n\n");
        fwrite($handle, "SET NAMES utf8mb4;\n");
        fwrite($handle, "SET foreign_key_checks = 0;\n\n");
        
        // Hole alle Tabellen
        $tables = $wpdb->get_results("SHOW TABLES", ARRAY_N);
        $table_count = 0;
        
        foreach ($tables as $table) {
            $table_name = $table[0];
            $table_count++;
            
            $this->update_backup_status($backup_id, 'dumping_database', "Exportiere Tabelle $table_count: $table_name");
            
            // CREATE TABLE Statement
            $create = $wpdb->get_row("SHOW CREATE TABLE `$table_name`", ARRAY_N);
            fwrite($handle, "\n-- Table: $table_name\n");
            fwrite($handle, "DROP TABLE IF EXISTS `$table_name`;\n");
            fwrite($handle, $create[1] . ";\n\n");
            
            // Daten in Batches exportieren
            $offset = 0;
            $batch_size = 1000;
            
            while (true) {
                $rows = $wpdb->get_results("SELECT * FROM `$table_name` LIMIT $offset, $batch_size", ARRAY_A);
                
                if (empty($rows)) break;
                
                foreach ($rows as $row) {
                    $values = array();
                    foreach ($row as $value) {
                        if ($value === null) {
                            $values[] = 'NULL';
                        } else {
                            $values[] = "'" . $wpdb->_real_escape($value) . "'";
                        }
                    }
                    fwrite($handle, "INSERT INTO `$table_name` VALUES (" . implode(', ', $values) . ");\n");
                }
                
                $offset += $batch_size;
            }
        }
        
        fwrite($handle, "\nSET foreign_key_checks = 1;\n");
        fclose($handle);
        
        // Zum ZIP hinzufügen
        $zip->addFile($dump_file, 'database/database.sql');
        
        // Cleanup nach ZIP-Erstellung
        register_shutdown_function(function() use ($dump_file) {
            if (file_exists($dump_file)) {
                @unlink($dump_file);
            }
        });
    }
    
    /**
     * Fügt Manifest zum ZIP hinzu
     */
    private function add_manifest($zip, $backup_type, $backup_id) {
        $manifest = array(
            'backup_id' => $backup_id,
            'backup_type' => $backup_type,
            'created_at' => date('Y-m-d H:i:s'),
            'wordpress_version' => get_bloginfo('version'),
            'php_version' => phpversion(),
            'site_url' => get_bloginfo('url'),
            'site_name' => get_bloginfo('name'),
            'wpma_version' => WPMA_VERSION,
            'db_prefix' => $GLOBALS['wpdb']->prefix,
            'active_plugins' => get_option('active_plugins'),
            'current_theme' => wp_get_theme()->get('Name')
        );
        
        $zip->addFromString('manifest.json', json_encode($manifest, JSON_PRETTY_PRINT));
    }
    
    /**
     * Lädt Backup zu S3/iDrive e2 hoch
     */
    private function upload_to_s3($file_path, $backup_id, $credentials, $bucket) {
        // Verwende WordPress HTTP API oder AWS SDK wenn verfügbar
        if (empty($credentials['access_key']) || empty($credentials['secret_key'])) {
            return null;
        }
        
        $endpoint = isset($credentials['endpoint']) ? $credentials['endpoint'] : '';
        if (!preg_match('/^https?:\/\//', $endpoint)) {
            $endpoint = 'https://' . $endpoint;
        }
        
        $bucket = !empty($bucket) ? $bucket : (isset($credentials['bucket']) ? $credentials['bucket'] : 'wpma-backups');
        $region = isset($credentials['region']) ? $credentials['region'] : 'us-east-1';
        $key = 'backups/' . basename($file_path);
        
        // S3 Upload mit WordPress HTTP API (vereinfacht)
        // In Produktion: AWS SDK verwenden
        try {
            $file_content = file_get_contents($file_path);
            $file_size = filesize($file_path);
            
            $date = gmdate('Ymd\THis\Z');
            $date_short = gmdate('Ymd');
            
            // AWS Signature V4
            $host = parse_url($endpoint, PHP_URL_HOST);
            $canonical_uri = '/' . $bucket . '/' . $key;
            $canonical_headers = "host:$host\nx-amz-content-sha256:UNSIGNED-PAYLOAD\nx-amz-date:$date\n";
            $signed_headers = 'host;x-amz-content-sha256;x-amz-date';
            
            $canonical_request = "PUT\n$canonical_uri\n\n$canonical_headers\n$signed_headers\nUNSIGNED-PAYLOAD";
            
            $string_to_sign = "AWS4-HMAC-SHA256\n$date\n$date_short/$region/s3/aws4_request\n" . hash('sha256', $canonical_request);
            
            $signing_key = hash_hmac('sha256', 'aws4_request',
                hash_hmac('sha256', 's3',
                    hash_hmac('sha256', $region,
                        hash_hmac('sha256', $date_short, 'AWS4' . $credentials['secret_key'], true),
                    true),
                true),
            true);
            
            $signature = hash_hmac('sha256', $string_to_sign, $signing_key);
            
            $authorization = "AWS4-HMAC-SHA256 Credential={$credentials['access_key']}/$date_short/$region/s3/aws4_request, SignedHeaders=$signed_headers, Signature=$signature";
            
            $response = wp_remote_request($endpoint . $canonical_uri, array(
                'method' => 'PUT',
                'timeout' => 300,
                'headers' => array(
                    'Authorization' => $authorization,
                    'x-amz-content-sha256' => 'UNSIGNED-PAYLOAD',
                    'x-amz-date' => $date,
                    'Content-Type' => 'application/zip',
                    'Content-Length' => $file_size
                ),
                'body' => $file_content
            ));
            
            if (is_wp_error($response)) {
                throw new Exception($response->get_error_message());
            }
            
            $code = wp_remote_retrieve_response_code($response);
            if ($code >= 200 && $code < 300) {
                return $endpoint . $canonical_uri;
            } else {
                throw new Exception('S3 Upload fehlgeschlagen: HTTP ' . $code);
            }
            
        } catch (Exception $e) {
            error_log('WPMA Backup S3 Upload Error: ' . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Holt Backup-Credentials vom Backend
     */
    private function get_backup_credentials() {
        $api_url = get_option('wpma_api_url', 'https://api.wpma.io');
        $api_key = get_option('wpma_api_key', '');
        
        $response = wp_remote_get($api_url . '/api/v1/backup/credentials', array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $api_key
            ),
            'timeout' => 30
        ));
        
        if (is_wp_error($response)) {
            return array();
        }
        
        $body = json_decode(wp_remote_retrieve_body($response), true);
        return isset($body['data']) ? $body['data'] : array();
    }
    
    /**
     * Hilfsfunktionen
     */
    private function ensure_backup_dir() {
        if (!file_exists($this->backup_dir)) {
            wp_mkdir_p($this->backup_dir);
            
            // .htaccess zum Schutz
            file_put_contents($this->backup_dir . '/.htaccess', 'deny from all');
            file_put_contents($this->backup_dir . '/index.php', '<?php // Silence is golden');
        }
    }
    
    private function generate_backup_id() {
        return 'backup_' . time() . '_' . wp_generate_password(8, false);
    }
    
    private function update_backup_status($backup_id, $status, $message) {
        set_transient('wpma_backup_status_' . $backup_id, array(
            'status' => $status,
            'message' => $message,
            'updated_at' => current_time('mysql')
        ), HOUR_IN_SECONDS);
    }
    
    private function log_backup($backup_id, $backup_type, $file_size, $s3_url) {
        global $wpdb;
        
        $wpdb->insert(
            $wpdb->prefix . 'wpma_logs',
            array(
                'log_type' => 'backup',
                'message' => 'Backup erstellt: ' . $backup_id,
                'data' => json_encode(array(
                    'backup_id' => $backup_id,
                    'backup_type' => $backup_type,
                    'file_size' => $file_size,
                    's3_url' => $s3_url
                ))
            ),
            array('%s', '%s', '%s')
        );
    }

    // ─────────────────────────────────────────────
    //  RESTORE
    // ─────────────────────────────────────────────

    /**
     * REST: Startet Restore asynchron via WP-Cron
     */
    public function rest_restore_backup($request) {
        $params       = $request->get_json_params();
        $download_url = isset($params['download_url']) ? esc_url_raw($params['download_url']) : '';
        $restore_type = isset($params['restore_type']) ? sanitize_text_field($params['restore_type']) : 'full';

        if (empty($download_url)) {
            return new WP_Error('missing_url', 'download_url ist erforderlich', array('status' => 400));
        }

        $restore_id = 'restore_' . time() . '_' . wp_generate_password(8, false);

        set_transient('wpma_restore_status_' . $restore_id, array(
            'restore_id' => $restore_id,
            'status'     => 'pending',
            'progress'   => 0,
            'message'    => 'Restore wurde in die Warteschlange eingereiht',
        ), 2 * HOUR_IN_SECONDS);

        // Asynchron über WP-Cron ausführen
        wp_schedule_single_event(time(), 'wpma_run_restore_async', array(
            $restore_id, $download_url, $restore_type
        ));
        spawn_cron();

        return rest_ensure_response(array(
            'success'    => true,
            'restore_id' => $restore_id,
            'status'     => 'pending',
            'message'    => 'Restore gestartet – läuft im Hintergrund',
        ));
    }

    /**
     * REST: Gibt Restore-Status zurück
     */
    public function rest_get_restore_status($request) {
        $restore_id = $request->get_param('restore_id');
        $status = get_transient('wpma_restore_status_' . $restore_id);
        if (!$status) {
            return new WP_Error('not_found', 'Restore nicht gefunden', array('status' => 404));
        }
        return rest_ensure_response($status);
    }

    /**
     * WP-Cron Hook: Führt Restore durch
     */
    public function run_restore_async($restore_id, $download_url, $restore_type) {
        $this->do_restore($restore_id, $download_url, $restore_type);
    }

    /**
     * Eigentliche Restore-Logik
     */
    private function do_restore($restore_id, $download_url, $restore_type) {
        @set_time_limit(600);
        @ini_set('memory_limit', '512M');

        try {
            $this->update_restore_status($restore_id, 'downloading', 'Lade Backup herunter...', 10);

            // ZIP herunterladen
            $zip_path = $this->backup_dir . '/' . $restore_id . '.zip';
            $response = wp_remote_get($download_url, array(
                'timeout'  => 300,
                'stream'   => true,
                'filename' => $zip_path,
            ));

            if (is_wp_error($response)) {
                throw new Exception('Download fehlgeschlagen: ' . $response->get_error_message());
            }

            $code = wp_remote_retrieve_response_code($response);
            if ($code < 200 || $code >= 300) {
                throw new Exception('Download HTTP-Fehler: ' . $code);
            }

            if (!file_exists($zip_path) || filesize($zip_path) < 100) {
                throw new Exception('Heruntergeladenes ZIP ist leer oder fehlt');
            }

            // ZIP öffnen
            $this->update_restore_status($restore_id, 'extracting', 'Extrahiere Backup...', 30);

            $zip = new ZipArchive();
            if ($zip->open($zip_path) !== true) {
                throw new Exception('Konnte ZIP nicht öffnen');
            }

            $wp_root    = ABSPATH;
            $wp_content = WP_CONTENT_DIR;

            // Manifest lesen
            $manifest_json = $zip->getFromName('manifest.json');
            $manifest      = $manifest_json ? json_decode($manifest_json, true) : array();
            $db_prefix     = isset($manifest['db_prefix']) ? $manifest['db_prefix'] : $GLOBALS['wpdb']->prefix;

            // Dateien wiederherstellen
            if ($restore_type === 'full' || $restore_type === 'files') {
                $this->update_restore_status($restore_id, 'extracting', 'Stelle wp-content wieder her...', 40);

                for ($i = 0; $i < $zip->numFiles; $i++) {
                    $name = $zip->getNameIndex($i);

                    if (strpos($name, 'wp-content/') === 0) {
                        $rel  = substr($name, strlen('wp-content/'));
                        $dest = $wp_content . '/' . $rel;

                        if (substr($name, -1) === '/') {
                            wp_mkdir_p($dest);
                        } else {
                            wp_mkdir_p(dirname($dest));
                            $content = $zip->getFromIndex($i);
                            if ($content !== false) {
                                file_put_contents($dest, $content);
                            }
                        }
                    } elseif ($name === 'wp-config.php' && ($restore_type === 'full')) {
                        // wp-config.php wiederherstellen (DB-Credentials bleiben aktuell)
                        $this->update_restore_status($restore_id, 'extracting', 'Stelle wp-config.php wieder her...', 55);
                        $content = $zip->getFromName('wp-config.php');
                        if ($content !== false) {
                            file_put_contents($wp_root . 'wp-config.php', $content);
                        }
                    }
                }
            }

            // Datenbank wiederherstellen
            if ($restore_type === 'full' || $restore_type === 'database') {
                $this->update_restore_status($restore_id, 'importing_db', 'Importiere Datenbank...', 70);

                $sql = $zip->getFromName('database/database.sql');
                if ($sql === false) {
                    // Fallback: altes Format
                    $sql = $zip->getFromName('database/dump.sql');
                }

                if ($sql !== false && strlen($sql) > 100) {
                    $this->import_sql($sql, $db_prefix);
                }
            }

            $zip->close();
            @unlink($zip_path);

            $this->update_restore_status($restore_id, 'completed', 'Restore erfolgreich abgeschlossen!', 100);

            // Cache leeren
            if (function_exists('wp_cache_flush')) wp_cache_flush();
            if (function_exists('opcache_reset'))  opcache_reset();

        } catch (Exception $e) {
            if (isset($zip) && $zip instanceof ZipArchive) {
                @$zip->close();
            }
            if (isset($zip_path) && file_exists($zip_path)) {
                @unlink($zip_path);
            }
            $this->update_restore_status($restore_id, 'failed', 'Fehler: ' . $e->getMessage(), 0);
            error_log('WPMA Restore Error: ' . $e->getMessage());
        }
    }

    /**
     * Importiert SQL-Dump via wpdb
     */
    private function import_sql($sql, $prefix) {
        global $wpdb;

        // Sicherheits-Check: nur Statements die zum aktuellen Prefix passen
        $wpdb->show_errors();
        $queries = $this->split_sql($sql);

        foreach ($queries as $query) {
            $query = trim($query);
            if (empty($query) || strpos($query, '--') === 0) continue;

            // Prefix anpassen falls nötig (Backup kann anderes Prefix haben)
            if ($prefix !== $wpdb->prefix) {
                $query = str_replace('`' . $prefix, '`' . $wpdb->prefix, $query);
            }

            $wpdb->query($query);
        }
    }

    /**
     * Teilt SQL-Dump in einzelne Statements
     */
    private function split_sql($sql) {
        $queries    = array();
        $current    = '';
        $in_string  = false;
        $string_char = '';

        for ($i = 0; $i < strlen($sql); $i++) {
            $char = $sql[$i];

            if ($in_string) {
                $current .= $char;
                if ($char === $string_char && $sql[$i - 1] !== '\\') {
                    $in_string = false;
                }
            } elseif ($char === '"' || $char === "'") {
                $in_string   = true;
                $string_char = $char;
                $current    .= $char;
            } elseif ($char === ';') {
                $current  .= $char;
                $queries[] = $current;
                $current   = '';
            } else {
                $current .= $char;
            }
        }

        if (trim($current) !== '') {
            $queries[] = $current;
        }

        return $queries;
    }

    private function update_restore_status($restore_id, $status, $message, $progress = 0) {
        set_transient('wpma_restore_status_' . $restore_id, array(
            'restore_id' => $restore_id,
            'status'     => $status,
            'message'    => $message,
            'progress'   => $progress,
            'updated_at' => current_time('mysql'),
        ), 2 * HOUR_IN_SECONDS);
    }

    /**
     * Berechnet die Größe des wp-content Verzeichnisses in Bytes.
     */
    private function get_content_dir_size() {
        $size = 0;
        try {
            $dir = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator(WP_CONTENT_DIR, FilesystemIterator::SKIP_DOTS),
                RecursiveIteratorIterator::LEAVES_ONLY
            );
            foreach ($dir as $file) {
                if ($file->isFile()) $size += $file->getSize();
            }
        } catch (Exception $e) {
            $size = 50 * 1048576; // Fallback 50 MB
        }
        return $size;
    }

    /**
     * Schätzt die Backup-Dauer in Sekunden.
     * Bei iDrive e2 / S3-Providern wird Upload-Geschwindigkeit berücksichtigt.
     *
     * @param int    $size_bytes  Dateigröße in Bytes
     * @param string $provider    'local' | 'idrive_e2' | 's3' | 'e2'
     * @param array  $credentials Provider-Credentials (optional)
     * @return int Geschätzte Sekunden
     */
    private function estimate_backup_seconds( $size_bytes, $provider, $credentials = array() ) {
        $size_mb = $size_bytes / 1048576;

        // Lokales Packen: ~50 MB/s auf typischem Shared-Hosting
        $pack_sec = $size_mb / 50;

        // Upload-Geschwindigkeit je Provider (MB/s, konservativ geschätzt)
        $upload_mbps = 10; // Standard
        if ( in_array($provider, array('idrive_e2', 'e2', 'idrivee2'), true) ) {
            // iDrive e2 Frankfurt: ~20–50 MB/s – wir nutzen 20 MB/s als sicheren Wert
            $upload_mbps = 20;
        } elseif ( in_array($provider, array('s3', 'aws'), true) ) {
            $upload_mbps = 15;
        } elseif ( $provider === 'local' ) {
            $upload_mbps = 0; // Kein Upload, nur lokales Speichern
        }

        $upload_sec = ($upload_mbps > 0) ? ($size_mb / $upload_mbps) : 0;

        return (int) ceil($pack_sec + $upload_sec + 5); // +5s Overhead
    }
}
