<?php
/**
 * WPMA Rollback - Automatisches Rollback bei fehlgeschlagenen Updates
 * 
 * @package WPMA_Agent
 * @since 1.2.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPMA_Rollback {
    
    private $backup_handler;
    private $rollback_dir;
    
    public function __construct() {
        $this->backup_handler = new WPMA_Backup();
        $this->rollback_dir = WP_CONTENT_DIR . '/wpma-rollback';
        $this->ensure_rollback_dir();
    }
    
    public function init() {
        // REST API Endpoints
        add_action('rest_api_init', array($this, 'register_rest_routes'));
        
        // Hook after updates
        add_action('upgrader_process_complete', array($this, 'after_update_check'), 10, 2);
    }
    
    /**
     * Registriert REST API Routen
     */
    public function register_rest_routes() {
        register_rest_route('wpma/v1', '/rollback/create-snapshot', array(
            'methods' => 'POST',
            'callback' => array($this, 'rest_create_snapshot'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));
        
        register_rest_route('wpma/v1', '/rollback/restore', array(
            'methods' => 'POST',
            'callback' => array($this, 'rest_restore_snapshot'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));
        
        register_rest_route('wpma/v1', '/rollback/health-check', array(
            'methods' => 'POST',
            'callback' => array($this, 'rest_health_check'),
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
     * REST: Erstellt Pre-Update Snapshot
     */
    public function rest_create_snapshot($request) {
        $params = $request->get_json_params();
        $snapshot_id = $params['snapshot_id'] ?? 'snapshot_' . time();
        $update_type = $params['update_type'] ?? 'mixed';
        
        try {
            $snapshot = $this->create_snapshot($snapshot_id, $update_type);
            
            return rest_ensure_response(array(
                'success' => true,
                'snapshot_id' => $snapshot['id'],
                'snapshot_path' => $snapshot['path'],
                'size' => $snapshot['size'],
                'message' => 'Pre-Update Snapshot erstellt'
            ));
            
        } catch (Exception $e) {
            return new WP_Error('snapshot_failed', $e->getMessage(), array('status' => 500));
        }
    }
    
    /**
     * REST: Stellt Snapshot wieder her (Rollback)
     */
    public function rest_restore_snapshot($request) {
        $params = $request->get_json_params();
        $snapshot_id = $params['snapshot_id'] ?? null;
        
        if (!$snapshot_id) {
            return new WP_Error('missing_snapshot', 'Snapshot ID fehlt', array('status' => 400));
        }
        
        try {
            $this->restore_snapshot($snapshot_id);
            
            return rest_ensure_response(array(
                'success' => true,
                'message' => 'Rollback erfolgreich durchgeführt'
            ));
            
        } catch (Exception $e) {
            return new WP_Error('rollback_failed', $e->getMessage(), array('status' => 500));
        }
    }
    
    /**
     * REST: Health-Check nach Update
     */
    public function rest_health_check($request) {
        $health = $this->perform_health_check();
        
        return rest_ensure_response(array(
            'success' => true,
            'healthy' => $health['healthy'],
            'issues' => $health['issues'],
            'checks' => $health['checks']
        ));
    }
    
    /**
     * Erstellt einen Snapshot vor einem Update
     */
    public function create_snapshot($snapshot_id, $update_type) {
        $snapshot_path = $this->rollback_dir . '/' . $snapshot_id;
        wp_mkdir_p($snapshot_path);
        
        $snapshot = array(
            'id' => $snapshot_id,
            'created_at' => current_time('mysql'),
            'update_type' => $update_type,
            'wp_version' => get_bloginfo('version'),
            'php_version' => phpversion(),
            'active_plugins' => get_option('active_plugins'),
            'active_theme' => wp_get_theme()->get_stylesheet()
        );
        
        // 1. Sichere aktive Plugins
        $this->log_rollback($snapshot_id, 'Sichere aktive Plugins...');
        $plugins_backup = array();
        foreach ($snapshot['active_plugins'] as $plugin) {
            $plugin_path = WP_PLUGIN_DIR . '/' . $plugin;
            if (file_exists($plugin_path)) {
                $backup_file = $snapshot_path . '/plugin_' . basename($plugin) . '.backup';
                copy($plugin_path, $backup_file);
                $plugins_backup[] = basename($plugin);
            }
        }
        $snapshot['plugins_backed_up'] = $plugins_backup;
        
        // 2. Sichere aktives Theme
        $this->log_rollback($snapshot_id, 'Sichere aktives Theme...');
        $theme_path = get_theme_root() . '/' . $snapshot['active_theme'];
        if (is_dir($theme_path)) {
            $theme_backup = $snapshot_path . '/theme_' . $snapshot['active_theme'] . '.zip';
            $this->zip_directory($theme_path, $theme_backup);
            $snapshot['theme_backed_up'] = true;
        }
        
        // 3. Sichere wp-config.php
        $this->log_rollback($snapshot_id, 'Sichere wp-config.php...');
        if (file_exists(ABSPATH . 'wp-config.php')) {
            copy(ABSPATH . 'wp-config.php', $snapshot_path . '/wp-config.php.backup');
            $snapshot['config_backed_up'] = true;
        }
        
        // 4. Erstelle Datenbank-Checkpoint (nur kritische Tabellen)
        $this->log_rollback($snapshot_id, 'Erstelle Datenbank-Checkpoint...');
        $db_backup = $this->create_db_checkpoint($snapshot_path);
        $snapshot['db_checkpoint'] = $db_backup;
        
        // 5. Speichere Error-Log Status
        $snapshot['error_log_before'] = $this->get_error_log_tail();
        
        // 6. Speichere Snapshot-Manifest
        file_put_contents(
            $snapshot_path . '/manifest.json',
            json_encode($snapshot, JSON_PRETTY_PRINT)
        );
        
        $this->log_rollback($snapshot_id, 'Snapshot erfolgreich erstellt');
        
        return array(
            'id' => $snapshot_id,
            'path' => $snapshot_path,
            'size' => $this->get_directory_size($snapshot_path)
        );
    }
    
    /**
     * Stellt einen Snapshot wieder her
     */
    public function restore_snapshot($snapshot_id) {
        $snapshot_path = $this->rollback_dir . '/' . $snapshot_id;
        
        if (!file_exists($snapshot_path)) {
            throw new Exception('Snapshot nicht gefunden: ' . $snapshot_id);
        }
        
        // Lade Manifest
        $manifest_file = $snapshot_path . '/manifest.json';
        if (!file_exists($manifest_file)) {
            throw new Exception('Snapshot-Manifest fehlt');
        }
        
        $manifest = json_decode(file_get_contents($manifest_file), true);
        
        $this->log_rollback($snapshot_id, 'Starte Rollback...');
        
        // 1. Deaktiviere alle Plugins temporär
        $this->log_rollback($snapshot_id, 'Deaktiviere Plugins...');
        $active_before_rollback = get_option('active_plugins');
        update_option('active_plugins', array());
        
        try {
            // 2. Stelle Plugins wieder her
            if (!empty($manifest['plugins_backed_up'])) {
                $this->log_rollback($snapshot_id, 'Stelle Plugins wieder her...');
                foreach ($manifest['plugins_backed_up'] as $plugin) {
                    $backup_file = $snapshot_path . '/plugin_' . $plugin . '.backup';
                    $target_file = WP_PLUGIN_DIR . '/' . $plugin;
                    
                    if (file_exists($backup_file)) {
                        copy($backup_file, $target_file);
                    }
                }
            }
            
            // 3. Stelle Theme wieder her
            if (!empty($manifest['theme_backed_up'])) {
                $this->log_rollback($snapshot_id, 'Stelle Theme wieder her...');
                $theme_backup = $snapshot_path . '/theme_' . $manifest['active_theme'] . '.zip';
                $theme_target = get_theme_root() . '/' . $manifest['active_theme'];
                
                if (file_exists($theme_backup)) {
                    // Lösche aktuelles Theme
                    $this->recursive_delete($theme_target);
                    
                    // Entpacke Backup
                    $zip = new ZipArchive();
                    if ($zip->open($theme_backup) === TRUE) {
                        $zip->extractTo(get_theme_root());
                        $zip->close();
                    }
                }
            }
            
            // 4. Stelle wp-config.php wieder her
            if (!empty($manifest['config_backed_up'])) {
                $this->log_rollback($snapshot_id, 'Stelle wp-config.php wieder her...');
                $config_backup = $snapshot_path . '/wp-config.php.backup';
                if (file_exists($config_backup)) {
                    copy($config_backup, ABSPATH . 'wp-config.php');
                }
            }
            
            // 5. Stelle Datenbank-Checkpoint wieder her
            if (!empty($manifest['db_checkpoint'])) {
                $this->log_rollback($snapshot_id, 'Stelle Datenbank-Checkpoint wieder her...');
                $this->restore_db_checkpoint($snapshot_path);
            }
            
            // 6. Reaktiviere ursprüngliche Plugins
            $this->log_rollback($snapshot_id, 'Reaktiviere Plugins...');
            update_option('active_plugins', $manifest['active_plugins']);
            
            // 7. Cache leeren
            wp_cache_flush();
            
            $this->log_rollback($snapshot_id, 'Rollback erfolgreich abgeschlossen!');
            
        } catch (Exception $e) {
            // Rollback fehlgeschlagen - reaktiviere wenigstens Plugins
            update_option('active_plugins', $active_before_rollback);
            throw new Exception('Rollback fehlgeschlagen: ' . $e->getMessage());
        }
    }
    
    /**
     * Führt Health-Check nach Update durch
     */
    public function perform_health_check() {
        $issues = array();
        $checks = array();
        
        // 1. Site erreichbar?
        $checks['site_reachable'] = $this->check_site_reachable();
        if (!$checks['site_reachable']) {
            $issues[] = 'Site nicht erreichbar';
        }
        
        // 2. WordPress geladen?
        $checks['wp_loaded'] = defined('ABSPATH');
        if (!$checks['wp_loaded']) {
            $issues[] = 'WordPress nicht geladen';
        }
        
        // 3. Plugins aktiv?
        $active_plugins = get_option('active_plugins', array());
        $checks['plugins_active'] = !empty($active_plugins);
        
        // 4. Datenbank-Verbindung?
        global $wpdb;
        $checks['db_connected'] = !empty($wpdb->check_connection());
        if (!$checks['db_connected']) {
            $issues[] = 'Datenbank-Verbindung fehlgeschlagen';
        }
        
        // 5. PHP-Fehler im Log?
        $recent_errors = $this->check_recent_php_errors();
        $checks['no_php_errors'] = empty($recent_errors);
        if (!empty($recent_errors)) {
            $issues = array_merge($issues, $recent_errors);
        }
        
        // 6. Admin-Bereich erreichbar?
        $checks['admin_reachable'] = $this->check_admin_access();
        if (!$checks['admin_reachable']) {
            $issues[] = 'Admin-Bereich nicht erreichbar';
        }
        
        return array(
            'healthy' => empty($issues),
            'issues' => $issues,
            'checks' => $checks,
            'timestamp' => current_time('mysql')
        );
    }
    
    /**
     * Hook: Nach Update automatisch Health-Check
     */
    public function after_update_check($upgrader, $options) {
        // Warte 10 Sekunden nach Update
        sleep(10);
        
        // Führe Health-Check durch
        $health = $this->perform_health_check();
        
        // Wenn nicht gesund, prüfe ob automatischer Rollback aktiviert ist
        if (!$health['healthy']) {
            $auto_rollback = get_option('wpma_auto_rollback_enabled', false);
            
            if ($auto_rollback) {
                $this->log_rollback('auto', 'Health-Check fehlgeschlagen nach Update - starte Auto-Rollback...');
                
                // Finde neuesten Snapshot
                $snapshots = $this->get_snapshots();
                if (!empty($snapshots)) {
                    $latest_snapshot = $snapshots[0];
                    
                    try {
                        $this->restore_snapshot($latest_snapshot['id']);
                        
                        // Benachrichtige Backend
                        $this->notify_backend_rollback($latest_snapshot['id'], $health['issues']);
                        
                    } catch (Exception $e) {
                        $this->log_rollback('auto', 'Auto-Rollback fehlgeschlagen: ' . $e->getMessage());
                    }
                }
            } else {
                // Nur benachrichtigen, nicht automatisch rollen
                $this->notify_backend_health_issues($health['issues']);
            }
        }
    }
    
    /**
     * Helper Functions
     */
    private function create_db_checkpoint($snapshot_path) {
        global $wpdb;
        
        // Sichere nur kritische Tabellen (options, postmeta können groß sein)
        $critical_tables = array('options', 'posts');
        $checkpoint_file = $snapshot_path . '/db_checkpoint.sql';
        
        $dump = "-- WPMA Database Checkpoint\n";
        $dump .= "-- Created: " . current_time('mysql') . "\n\n";
        
        foreach ($critical_tables as $table) {
            $full_table = $wpdb->prefix . $table;
            
            // Table structure
            $create = $wpdb->get_row("SHOW CREATE TABLE `{$full_table}`", ARRAY_N);
            if ($create) {
                $dump .= $create[1] . ";\n\n";
            }
            
            // Table data (nur bei options - posts zu groß)
            if ($table === 'options') {
                $rows = $wpdb->get_results("SELECT * FROM `{$full_table}`", ARRAY_A);
                foreach ($rows as $row) {
                    $values = array();
                    foreach ($row as $value) {
                        $values[] = "'" . $wpdb->_real_escape($value) . "'";
                    }
                    $dump .= "INSERT INTO `{$full_table}` VALUES (" . implode(', ', $values) . ");\n";
                }
            }
        }
        
        file_put_contents($checkpoint_file, $dump);
        
        return basename($checkpoint_file);
    }
    
    private function restore_db_checkpoint($snapshot_path) {
        global $wpdb;
        
        $checkpoint_file = $snapshot_path . '/db_checkpoint.sql';
        if (!file_exists($checkpoint_file)) {
            return;
        }
        
        $sql = file_get_contents($checkpoint_file);
        
        // Führe SQL aus
        $wpdb->query($sql);
    }
    
    private function check_site_reachable() {
        $url = get_site_url();
        $response = wp_remote_head($url, array('timeout' => 5));
        return !is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200;
    }
    
    private function check_admin_access() {
        $admin_url = admin_url();
        $response = wp_remote_head($admin_url, array('timeout' => 5));
        return !is_wp_error($response);
    }
    
    private function check_recent_php_errors() {
        $error_log = ini_get('error_log');
        if (!$error_log || !file_exists($error_log)) {
            return array();
        }
        
        $recent_lines = $this->tail_file($error_log, 50);
        $errors = array();
        
        // Suche nach kritischen Fehlern
        foreach ($recent_lines as $line) {
            if (strpos($line, 'Fatal error') !== false || strpos($line, 'Parse error') !== false) {
                $errors[] = $line;
            }
        }
        
        return $errors;
    }
    
    private function get_error_log_tail() {
        $error_log = ini_get('error_log');
        if (!$error_log || !file_exists($error_log)) {
            return '';
        }
        
        return implode("\n", $this->tail_file($error_log, 20));
    }
    
    private function tail_file($file, $lines = 10) {
        $handle = fopen($file, 'r');
        if (!$handle) return array();
        
        $linecounter = $lines;
        $pos = -2;
        $beginning = false;
        $text = array();
        
        while ($linecounter > 0) {
            $t = ' ';
            while ($t != "\n") {
                if (fseek($handle, $pos, SEEK_END) == -1) {
                    $beginning = true;
                    break;
                }
                $t = fgetc($handle);
                $pos--;
            }
            $linecounter--;
            if ($beginning) {
                rewind($handle);
            }
            $text[$lines - $linecounter - 1] = fgets($handle);
            if ($beginning) break;
        }
        
        fclose($handle);
        return array_reverse($text);
    }
    
    private function get_snapshots() {
        if (!file_exists($this->rollback_dir)) {
            return array();
        }
        
        $snapshots = array();
        $dirs = scandir($this->rollback_dir);
        
        foreach ($dirs as $dir) {
            if ($dir === '.' || $dir === '..') continue;
            
            $manifest_file = $this->rollback_dir . '/' . $dir . '/manifest.json';
            if (file_exists($manifest_file)) {
                $manifest = json_decode(file_get_contents($manifest_file), true);
                $snapshots[] = $manifest;
            }
        }
        
        // Sortiere nach Erstellungszeit
        usort($snapshots, function($a, $b) {
            return strtotime($b['created_at']) - strtotime($a['created_at']);
        });
        
        return $snapshots;
    }
    
    private function zip_directory($source, $destination) {
        if (!extension_loaded('zip')) {
            return false;
        }
        
        $zip = new ZipArchive();
        if (!$zip->open($destination, ZipArchive::CREATE)) {
            return false;
        }
        
        $source = realpath($source);
        
        if (is_dir($source)) {
            $iterator = new RecursiveDirectoryIterator($source, RecursiveDirectoryIterator::SKIP_DOTS);
            $files = new RecursiveIteratorIterator($iterator, RecursiveIteratorIterator::SELF_FIRST);
            
            foreach ($files as $file) {
                $file = realpath($file);
                if (is_dir($file)) {
                    $zip->addEmptyDir(str_replace($source . '/', '', $file . '/'));
                } else if (is_file($file)) {
                    $zip->addFile($file, str_replace($source . '/', '', $file));
                }
            }
        }
        
        return $zip->close();
    }
    
    private function recursive_delete($dir) {
        if (!file_exists($dir)) return;
        
        $files = array_diff(scandir($dir), array('.', '..'));
        foreach ($files as $file) {
            $path = $dir . '/' . $file;
            is_dir($path) ? $this->recursive_delete($path) : unlink($path);
        }
        
        rmdir($dir);
    }
    
    private function get_directory_size($dir) {
        $size = 0;
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir)) as $file) {
            $size += $file->getSize();
        }
        return $size;
    }
    
    private function ensure_rollback_dir() {
        if (!file_exists($this->rollback_dir)) {
            wp_mkdir_p($this->rollback_dir);
            file_put_contents($this->rollback_dir . '/.htaccess', 'deny from all');
            file_put_contents($this->rollback_dir . '/index.php', '<?php // Silence is golden');
        }
    }
    
    private function notify_backend_rollback($snapshot_id, $issues) {
        $api_url = get_option('wpma_api_url', 'https://api.wpma.io');
        $api_key = get_option('wpma_api_key', '');
        $site_id = get_option('wpma_site_id', '');
        
        wp_remote_post($api_url . '/api/v1/rollback/notify', array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $api_key,
                'Content-Type' => 'application/json'
            ),
            'body' => json_encode(array(
                'site_id' => $site_id,
                'snapshot_id' => $snapshot_id,
                'issues' => $issues,
                'rollback_type' => 'automatic'
            ))
        ));
    }
    
    private function notify_backend_health_issues($issues) {
        $api_url = get_option('wpma_api_url', 'https://api.wpma.io');
        $api_key = get_option('wpma_api_key', '');
        $site_id = get_option('wpma_site_id', '');
        
        wp_remote_post($api_url . '/api/v1/rollback/health-alert', array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $api_key,
                'Content-Type' => 'application/json'
            ),
            'body' => json_encode(array(
                'site_id' => $site_id,
                'issues' => $issues
            ))
        ));
    }
    
    private function log_rollback($snapshot_id, $message) {
        error_log("WPMA Rollback [{$snapshot_id}]: {$message}");
        
        global $wpdb;
        $table = $wpdb->prefix . 'wpma_logs';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table) {
            $wpdb->insert($table, array(
                'log_type' => 'rollback',
                'message' => "[{$snapshot_id}] {$message}",
                'created_at' => current_time('mysql')
            ));
        }
    }
}
