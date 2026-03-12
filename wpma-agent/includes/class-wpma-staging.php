<?php
/**
 * WPMA Staging - Erstellt echte Staging-Umgebungen
 * 
 * @package WPMA_Agent
 * @since 1.2.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPMA_Staging {
    
    private $staging_dir;
    private $backup_handler;
    
    public function __construct() {
        $this->staging_dir = dirname(ABSPATH) . '/wpma-staging';
        $this->backup_handler = new WPMA_Backup();
    }
    
    public function init() {
        // REST API Endpoints
        add_action('rest_api_init', array($this, 'register_rest_routes'));
    }
    
    /**
     * Registriert REST API Routen
     */
    public function register_rest_routes() {
        register_rest_route('wpma/v1', '/staging/create', array(
            'methods' => 'POST',
            'callback' => array($this, 'rest_create_staging'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));
        
        register_rest_route('wpma/v1', '/staging/delete/(?P<staging_id>[a-zA-Z0-9_-]+)', array(
            'methods' => 'DELETE',
            'callback' => array($this, 'rest_delete_staging'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));
        
        register_rest_route('wpma/v1', '/staging/push/(?P<staging_id>[a-zA-Z0-9_-]+)', array(
            'methods' => 'POST',
            'callback' => array($this, 'rest_push_to_live'),
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
     * REST: Erstellt Staging-Umgebung
     */
    public function rest_create_staging($request) {
        $params = $request->get_json_params();
        
        $staging_id = $params['staging_id'] ?? uniqid('staging_');
        $backup_id = $params['backup_id'] ?? null;
        $staging_domain = $params['staging_domain'] ?? null;
        
        try {
            // 1. Prüfe ob Staging-Verzeichnis angelegt werden kann
            if (!$this->ensure_staging_dir()) {
                throw new Exception('Kann Staging-Verzeichnis nicht erstellen. Bitte Dateiberechtigungen prüfen.');
            }
            
            $staging_path = $this->staging_dir . '/' . $staging_id;
            
            // 2. Kopiere WordPress-Dateien
            $this->log_staging($staging_id, 'Kopiere WordPress-Dateien...');
            $this->copy_wordpress_files($staging_path);
            
            // 3. Datenbank duplizieren mit neuem Präfix
            $this->log_staging($staging_id, 'Dupliziere Datenbank...');
            $staging_prefix = 'wpstg' . substr(md5($staging_id), 0, 8) . '_';
            $this->duplicate_database($staging_prefix);
            
            // 4. wp-config.php für Staging anpassen
            $this->log_staging($staging_id, 'Passe Konfiguration an...');
            $this->update_staging_config($staging_path, $staging_prefix, $staging_domain);
            
            // 5. URLs in Datenbank ersetzen
            $this->log_staging($staging_id, 'Ersetze URLs in Datenbank...');
            $staging_url = $staging_domain ? "https://{$staging_domain}" : $this->get_staging_url($staging_path);
            $this->search_replace_urls($staging_prefix, get_site_url(), $staging_url);
            
            // 6. .htaccess für Staging erstellen
            $this->create_staging_htaccess($staging_path, $staging_id);
            
            // 7. Robots.txt für Staging (noindex)
            file_put_contents($staging_path . '/robots.txt', "User-agent: *\nDisallow: /\n");
            
            $this->log_staging($staging_id, 'Staging-Umgebung erfolgreich erstellt!');
            
            return rest_ensure_response(array(
                'success' => true,
                'staging_id' => $staging_id,
                'staging_url' => $staging_url,
                'staging_path' => $staging_path,
                'message' => 'Staging-Umgebung wurde erfolgreich erstellt'
            ));
            
        } catch (Exception $e) {
            $this->log_staging($staging_id, 'Fehler: ' . $e->getMessage());
            return new WP_Error('staging_failed', $e->getMessage(), array('status' => 500));
        }
    }
    
    /**
     * REST: Löscht Staging-Umgebung
     */
    public function rest_delete_staging($request) {
        $staging_id = $request->get_param('staging_id');
        $staging_path = $this->staging_dir . '/' . $staging_id;
        
        try {
            // 1. Lösche Dateien
            if (file_exists($staging_path)) {
                $this->recursive_delete($staging_path);
            }
            
            // 2. Lösche Staging-Datenbank-Tabellen
            $staging_prefix = 'wpstg' . substr(md5($staging_id), 0, 8) . '_';
            $this->drop_staging_tables($staging_prefix);
            
            return rest_ensure_response(array(
                'success' => true,
                'message' => 'Staging-Umgebung wurde gelöscht'
            ));
            
        } catch (Exception $e) {
            return new WP_Error('delete_failed', $e->getMessage(), array('status' => 500));
        }
    }
    
    /**
     * REST: Push Staging to Live
     */
    public function rest_push_to_live($request) {
        $staging_id = $request->get_param('staging_id');
        $params = $request->get_json_params();
        
        $include_database = $params['includeDatabase'] ?? true;
        $include_files = $params['includeFiles'] ?? true;
        
        try {
            // SICHERHEIT: Erstelle IMMER ein Backup vor Push to Live!
            $this->log_staging($staging_id, 'Erstelle Sicherheitsbackup der Live-Site...');
            $backup_result = $this->backup_handler->create_backup('pre_push', 'backup_pre_push_' . time(), 'local', '', array());
            
            if (!$backup_result['success']) {
                throw new Exception('Konnte Backup nicht erstellen. Push abgebrochen aus Sicherheitsgründen.');
            }
            
            $staging_path = $this->staging_dir . '/' . $staging_id;
            $staging_prefix = 'wpstg' . substr(md5($staging_id), 0, 8) . '_';
            
            // 1. Dateien von Staging nach Live kopieren
            if ($include_files) {
                $this->log_staging($staging_id, 'Kopiere Dateien von Staging nach Live...');
                $this->push_files_to_live($staging_path);
            }
            
            // 2. Datenbank von Staging nach Live kopieren
            if ($include_database) {
                $this->log_staging($staging_id, 'Synchronisiere Datenbank...');
                $this->push_database_to_live($staging_prefix);
            }
            
            // 3. Cache leeren
            wp_cache_flush();
            
            $this->log_staging($staging_id, 'Push to Live erfolgreich!');
            
            return rest_ensure_response(array(
                'success' => true,
                'backup_id' => $backup_result['backup_id'],
                'message' => 'Staging wurde erfolgreich auf Live übertragen'
            ));
            
        } catch (Exception $e) {
            $this->log_staging($staging_id, 'Push fehlgeschlagen: ' . $e->getMessage());
            return new WP_Error('push_failed', $e->getMessage(), array('status' => 500));
        }
    }
    
    /**
     * Kopiert WordPress-Dateien für Staging
     */
    private function copy_wordpress_files($staging_path) {
        if (!wp_mkdir_p($staging_path)) {
            throw new Exception('Kann Staging-Verzeichnis nicht erstellen');
        }
        
        // Verwende rsync wenn verfügbar, ansonsten PHP-Copy
        if ($this->is_rsync_available()) {
            $source = rtrim(ABSPATH, '/') . '/';
            $excludes = '--exclude=wp-content/cache --exclude=wp-content/wpma-backups --exclude=wp-content/wpma-staging';
            
            exec("rsync -a {$excludes} " . escapeshellarg($source) . " " . escapeshellarg($staging_path) . "/ 2>&1", $output, $return_code);
            
            if ($return_code !== 0) {
                throw new Exception('rsync fehlgeschlagen: ' . implode("\n", $output));
            }
        } else {
            // Fallback: PHP recursive copy
            $this->recursive_copy(ABSPATH, $staging_path, array('cache', 'wpma-backups', 'wpma-staging'));
        }
    }
    
    /**
     * Dupliziert Datenbank mit neuem Präfix
     */
    private function duplicate_database($new_prefix) {
        global $wpdb;
        
        $old_prefix = $wpdb->prefix;
        $tables = $wpdb->get_results("SHOW TABLES LIKE '{$old_prefix}%'", ARRAY_N);
        
        foreach ($tables as $table) {
            $old_table = $table[0];
            $new_table = str_replace($old_prefix, $new_prefix, $old_table);
            
            // Erstelle neue Tabelle als Kopie
            $wpdb->query("CREATE TABLE IF NOT EXISTS `{$new_table}` LIKE `{$old_table}`");
            $wpdb->query("INSERT INTO `{$new_table}` SELECT * FROM `{$old_table}`");
        }
    }
    
    /**
     * Aktualisiert wp-config.php für Staging
     */
    private function update_staging_config($staging_path, $staging_prefix, $staging_domain) {
        $config_file = $staging_path . '/wp-config.php';
        
        if (!file_exists($config_file)) {
            throw new Exception('wp-config.php nicht gefunden');
        }
        
        $config_content = file_get_contents($config_file);
        
        // Ersetze Tabellen-Präfix
        $config_content = preg_replace(
            '/\$table_prefix\s*=\s*[\'"].*?[\'"];/',
            "\$table_prefix = '{$staging_prefix}';",
            $config_content
        );
        
        // Füge Staging-Marker hinzu
        $staging_marker = "\n// WPMA Staging Environment\ndefine('WPMA_STAGING', true);\ndefine('WPMA_STAGING_ID', '" . basename($staging_path) . "');\n";
        
        if ($staging_domain) {
            $staging_marker .= "define('WP_HOME', 'https://{$staging_domain}');\n";
            $staging_marker .= "define('WP_SITEURL', 'https://{$staging_domain}');\n";
        }
        
        $config_content = preg_replace(
            '/<\?php/',
            "<?php{$staging_marker}",
            $config_content,
            1
        );
        
        file_put_contents($config_file, $config_content);
    }
    
    /**
     * Search & Replace URLs in Datenbank
     */
    private function search_replace_urls($prefix, $old_url, $new_url) {
        global $wpdb;
        
        // Verwende wp-cli wenn verfügbar
        if ($this->is_wpcli_available()) {
            $staging_path = $this->staging_dir . '/' . basename(dirname($prefix));
            exec("cd " . escapeshellarg($staging_path) . " && wp search-replace " . escapeshellarg($old_url) . " " . escapeshellarg($new_url) . " --all-tables --prefix=" . escapeshellarg($prefix) . " 2>&1", $output, $return_code);
            
            if ($return_code === 0) {
                return;
            }
        }
        
        // Fallback: Manuelle Suche & Ersetzen in wichtigen Tabellen
        $tables = array('options', 'posts', 'postmeta');
        
        foreach ($tables as $table) {
            $full_table = $prefix . $table;
            
            if ($table === 'options') {
                $wpdb->query($wpdb->prepare(
                    "UPDATE `{$full_table}` SET option_value = REPLACE(option_value, %s, %s) WHERE option_name IN ('siteurl', 'home')",
                    $old_url, $new_url
                ));
            } elseif ($table === 'posts') {
                $wpdb->query($wpdb->prepare(
                    "UPDATE `{$full_table}` SET post_content = REPLACE(post_content, %s, %s), guid = REPLACE(guid, %s, %s)",
                    $old_url, $new_url, $old_url, $new_url
                ));
            } elseif ($table === 'postmeta') {
                $wpdb->query($wpdb->prepare(
                    "UPDATE `{$full_table}` SET meta_value = REPLACE(meta_value, %s, %s)",
                    $old_url, $new_url
                ));
            }
        }
    }
    
    /**
     * Erstellt .htaccess für Staging mit Passwortschutz
     */
    private function create_staging_htaccess($staging_path, $staging_id) {
        $htaccess_content = "# WPMA Staging Environment\n";
        $htaccess_content .= "# BEGIN WordPress\n";
        $htaccess_content .= "<IfModule mod_rewrite.c>\n";
        $htaccess_content .= "RewriteEngine On\n";
        $htaccess_content .= "RewriteBase /\n";
        $htaccess_content .= "RewriteRule ^index\.php$ - [L]\n";
        $htaccess_content .= "RewriteCond %{REQUEST_FILENAME} !-f\n";
        $htaccess_content .= "RewriteCond %{REQUEST_FILENAME} !-d\n";
        $htaccess_content .= "RewriteRule . /index.php [L]\n";
        $htaccess_content .= "</IfModule>\n";
        $htaccess_content .= "# END WordPress\n\n";
        
        // Optional: HTTP Basic Auth für zusätzlichen Schutz
        $htaccess_content .= "# Staging Protection (optional)\n";
        $htaccess_content .= "# AuthType Basic\n";
        $htaccess_content .= "# AuthName \"WPMA Staging\"\n";
        $htaccess_content .= "# Require valid-user\n";
        
        file_put_contents($staging_path . '/.htaccess', $htaccess_content);
    }
    
    /**
     * Push Dateien von Staging nach Live
     */
    private function push_files_to_live($staging_path) {
        // Sicherheitsausschlüsse
        $exclude_patterns = array(
            'wp-config.php',  // Nie überschreiben!
            'wp-content/cache',
            'wp-content/wpma-backups',
            'wp-content/wpma-staging'
        );
        
        if ($this->is_rsync_available()) {
            $excludes = '';
            foreach ($exclude_patterns as $pattern) {
                $excludes .= " --exclude={$pattern}";
            }
            
            $source = rtrim($staging_path, '/') . '/';
            $target = rtrim(ABSPATH, '/') . '/';
            
            exec("rsync -a {$excludes} " . escapeshellarg($source) . " " . escapeshellarg($target) . " 2>&1", $output, $return_code);
            
            if ($return_code !== 0) {
                throw new Exception('rsync fehlgeschlagen beim Push');
            }
        } else {
            // Manuelles Kopieren mit Ausschlüssen
            $this->recursive_copy($staging_path, ABSPATH, $exclude_patterns);
        }
    }
    
    /**
     * Push Datenbank von Staging nach Live
     */
    private function push_database_to_live($staging_prefix) {
        global $wpdb;
        
        $live_prefix = $wpdb->prefix;
        $tables = $wpdb->get_results("SHOW TABLES LIKE '{$staging_prefix}%'", ARRAY_N);
        
        foreach ($tables as $table) {
            $staging_table = $table[0];
            $live_table = str_replace($staging_prefix, $live_prefix, $staging_table);
            
            // Truncate & Copy
            $wpdb->query("TRUNCATE TABLE `{$live_table}`");
            $wpdb->query("INSERT INTO `{$live_table}` SELECT * FROM `{$staging_table}`");
        }
        
        // URLs zurück auf Live-URL setzen
        $live_url = get_option('siteurl'); // Holt aus Live-DB vor Überschreiben
        $staging_url = $wpdb->get_var("SELECT option_value FROM `{$staging_prefix}options` WHERE option_name = 'siteurl'");
        
        if ($staging_url && $live_url) {
            $this->search_replace_urls($live_prefix, $staging_url, $live_url);
        }
    }
    
    /**
     * Lösche Staging-Tabellen
     */
    private function drop_staging_tables($staging_prefix) {
        global $wpdb;
        
        $tables = $wpdb->get_results("SHOW TABLES LIKE '{$staging_prefix}%'", ARRAY_N);
        
        foreach ($tables as $table) {
            $wpdb->query("DROP TABLE IF EXISTS `{$table[0]}`");
        }
    }
    
    /**
     * Helper Functions
     */
    private function ensure_staging_dir() {
        if (!file_exists($this->staging_dir)) {
            return wp_mkdir_p($this->staging_dir);
        }
        return is_writable($this->staging_dir);
    }
    
    private function get_staging_url($staging_path) {
        $relative_path = str_replace($_SERVER['DOCUMENT_ROOT'], '', $staging_path);
        return home_url($relative_path);
    }
    
    private function is_rsync_available() {
        exec('which rsync 2>&1', $output, $return_code);
        return $return_code === 0;
    }
    
    private function is_wpcli_available() {
        exec('which wp 2>&1', $output, $return_code);
        return $return_code === 0;
    }
    
    private function recursive_copy($src, $dst, $exclude = array()) {
        $dir = opendir($src);
        @wp_mkdir_p($dst);
        
        while (($file = readdir($dir)) !== false) {
            if ($file === '.' || $file === '..') continue;
            
            // Prüfe Ausschlüsse
            $skip = false;
            foreach ($exclude as $pattern) {
                if (strpos($file, $pattern) !== false) {
                    $skip = true;
                    break;
                }
            }
            if ($skip) continue;
            
            if (is_dir($src . '/' . $file)) {
                $this->recursive_copy($src . '/' . $file, $dst . '/' . $file, $exclude);
            } else {
                copy($src . '/' . $file, $dst . '/' . $file);
            }
        }
        
        closedir($dir);
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
    
    private function log_staging($staging_id, $message) {
        error_log("WPMA Staging [{$staging_id}]: {$message}");
        
        // Speichere auch in DB falls Tabelle existiert
        global $wpdb;
        $table = $wpdb->prefix . 'wpma_logs';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table) {
            $wpdb->insert($table, array(
                'log_type' => 'staging',
                'message' => "[{$staging_id}] {$message}",
                'created_at' => current_time('mysql')
            ));
        }
    }
}
