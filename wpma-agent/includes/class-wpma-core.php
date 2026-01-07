<?php

class WPMA_Core {
    
    private $api_key;
    private $site_id;
    private $api_client;
    
    public function __construct() {
        $this->api_key = get_option('wpma_api_key', '');
        $this->site_id = get_option('wpma_site_id', '');
        $this->api_client = new WPMA_API();
    }
    
    public function init() {
        // Add admin menu
        add_action('admin_menu', array($this, 'add_admin_menu'));
        
        // Add settings page
        add_action('admin_init', array($this, 'register_settings'));
        
        // Add cron job handlers
        add_action('wpma_health_check', array($this, 'run_health_check'));
        add_action('wpma_security_scan', array($this, 'run_security_scan'));
        add_action('wpma_backup_check', array($this, 'run_backup_check'));
        add_action('wpma_performance_check', array($this, 'run_performance_check'));
        
        // Add AJAX handlers
        add_action('wp_ajax_wpma_register_site', array($this, 'ajax_register_site'));
        add_action('wp_ajax_wpma_update_health', array($this, 'ajax_update_health'));
        add_action('wp_ajax_wpma_exchange_token', array($this, 'ajax_exchange_token'));
        
        // Add admin notices
        add_action('admin_notices', array($this, 'admin_notices'));
    }
    
    public static function create_tables() {
        global $wpdb;
        
        $charset_collate = $wpdb->get_charset_collate();
        
        $sql = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}wpma_settings (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            setting_key varchar(255) NOT NULL,
            setting_value longtext NOT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY setting_key (setting_key)
        ) $charset_collate;";
        
        $sql .= "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}wpma_logs (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            log_type varchar(50) NOT NULL,
            message text NOT NULL,
            data longtext,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY log_type (log_type),
            KEY created_at (created_at)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }
    
    public function add_admin_menu() {
        add_menu_page(
            'WPMA.io',
            'WPMA.io',
            'manage_options',
            'wpma-agent',
            array($this, 'admin_page'),
            'dashicons-superhero-alt',
            30
        );
        
        // Erstes Untermenü umbenennen (ersetzt automatisch generierten Eintrag)
        add_submenu_page(
            'wpma-agent',
            'Dashboard',
            'Dashboard',
            'manage_options',
            'wpma-agent',
            array($this, 'admin_page')
        );
        
        add_submenu_page(
            'wpma-agent',
            'Einstellungen',
            'Einstellungen',
            'manage_options',
            'wpma-agent-settings',
            array($this, 'settings_page')
        );
    }
    
    public function admin_page() {
        include WPMA_PLUGIN_PATH . 'admin/views/dashboard.php';
    }
    
    public function settings_page() {
        include WPMA_PLUGIN_PATH . 'admin/views/settings.php';
    }
    
    public function register_settings() {
        register_setting('wpma_settings', 'wpma_api_key');
        register_setting('wpma_settings', 'wpma_site_id');
        register_setting('wpma_settings', 'wpma_enable_monitoring');
        register_setting('wpma_settings', 'wpma_enable_backups');
        register_setting('wpma_settings', 'wpma_enable_security_scans');
    }
    
    public function run_health_check() {
        if (!$this->api_key) {
            $this->log('health_check', 'API key not configured');
            return;
        }
        
        $health_data = $this->collect_health_data();
        $response = $this->api_client->update_health($this->site_id, $health_data);
        
        if ($response && $response['success']) {
            $this->log('health_check', 'Health check completed successfully');
        } else {
            $this->log('health_check', 'Health check failed: ' . ($response['error'] ?? 'Unknown error'));
        }
    }
    
    public function run_security_scan() {
        if (!$this->api_key || !get_option('wpma_enable_security_scans', true)) {
            return;
        }
        
        $security = new WPMA_Security();
        $result = $security->send_security_scan();
        
        if ($result && isset($result['success']) && $result['success']) {
            $this->log('security_scan', 'Security scan completed successfully');
        } else {
            $this->log('security_scan', 'Security scan failed: ' . ($result['error'] ?? 'Unknown error'));
        }
    }
    
    public function run_backup_check() {
        if (!$this->api_key || !get_option('wpma_enable_backups', true)) {
            return;
        }
        
        $backup_data = $this->collect_backup_data();
        $response = $this->api_client->update_backup_status($this->site_id, $backup_data);
        
        if ($response && $response['success']) {
            $this->log('backup_check', 'Backup check completed successfully');
        } else {
            $this->log('backup_check', 'Backup check failed: ' . ($response['error'] ?? 'Unknown error'));
        }
    }
    
    public function run_performance_check() {
        if (!$this->api_key) {
            return;
        }
        
        $performance = new WPMA_Performance();
        $result = $performance->send_complete_metrics();
        
        if ($result && isset($result['success']) && $result['success']) {
            $this->log('performance_check', 'Performance metrics sent successfully');
        } else {
            $this->log('performance_check', 'Performance check failed: ' . ($result['error'] ?? 'Unknown error'));
        }
    }
    
    private function collect_health_data() {
        global $wp_version;
        
        $data = array(
            'wordpress_version' => $wp_version,
            'php_version' => PHP_VERSION,
            'site_url' => get_site_url(),
            'home_url' => get_home_url(),
            'admin_email' => get_option('admin_email'),
            'timezone' => get_option('timezone_string'),
            'memory_limit' => WP_MEMORY_LIMIT,
            'max_execution_time' => ini_get('max_execution_time'),
            'upload_max_filesize' => ini_get('upload_max_filesize'),
            'post_max_size' => ini_get('post_max_size'),
            'active_plugins' => $this->get_active_plugins(),
            'theme' => $this->get_current_theme(),
            'database_size' => $this->get_database_size(),
            'performance_metrics' => $this->get_performance_metrics(),
            'security_status' => $this->get_security_status()
        );
        
        return $data;
    }
    
    private function collect_security_data() {
        $data = array(
            'debug_mode' => WP_DEBUG,
            'file_editing' => !DISALLOW_FILE_EDIT,
            'admin_username' => $this->get_admin_username(),
            'failed_logins' => $this->get_failed_logins(),
            'ssl_enabled' => is_ssl(),
            'file_permissions' => $this->check_file_permissions(),
            'plugin_vulnerabilities' => $this->check_plugin_vulnerabilities(),
            'theme_vulnerabilities' => $this->check_theme_vulnerabilities()
        );
        
        return $data;
    }
    
    private function collect_backup_data() {
        $data = array(
            'last_backup' => get_option('wpma_last_backup', ''),
            'backup_size' => $this->get_backup_size(),
            'backup_status' => get_option('wpma_backup_status', 'unknown'),
            'backup_files' => $this->get_backup_files()
        );
        
        return $data;
    }
    
    private function get_active_plugins() {
        $plugins = get_option('active_plugins');
        $plugin_data = array();
        
        foreach ($plugins as $plugin) {
            if (file_exists(WP_PLUGIN_DIR . '/' . $plugin)) {
                $plugin_info = get_plugin_data(WP_PLUGIN_DIR . '/' . $plugin);
                $plugin_data[] = array(
                    'name' => $plugin_info['Name'],
                    'version' => $plugin_info['Version'],
                    'plugin' => $plugin
                );
            }
        }
        
        return $plugin_data;
    }
    
    private function get_current_theme() {
        $theme = wp_get_theme();
        return array(
            'name' => $theme->get('Name'),
            'version' => $theme->get('Version'),
            'author' => $theme->get('Author')
        );
    }
    
    private function get_database_size() {
        global $wpdb;
        
        $result = $wpdb->get_row("
            SELECT 
                ROUND(SUM(data_length + index_length) / 1024 / 1024, 1) AS 'size'
            FROM information_schema.tables 
            WHERE table_schema = DATABASE()
        ");
        
        return $result ? $result->size : 0;
    }
    
    private function get_performance_metrics() {
        $start_time = microtime(true);
        
        // Simulate a page load
        $query = new WP_Query(array('posts_per_page' => 1));
        $query->get_posts();
        
        $end_time = microtime(true);
        $load_time = ($end_time - $start_time) * 1000; // Convert to milliseconds
        
        return array(
            'page_load_time' => round($load_time, 2),
            'memory_usage' => memory_get_usage(true),
            'peak_memory' => memory_get_peak_usage(true)
        );
    }
    
    private function get_security_status() {
        return array(
            'wp_version_current' => $this->is_wp_version_current(),
            'ssl_enabled' => is_ssl(),
            'debug_mode' => WP_DEBUG,
            'admin_username' => $this->get_admin_username(),
            'failed_logins_24h' => $this->get_failed_logins()
        );
    }
    
    private function is_wp_version_current() {
        $current = get_site_transient('update_core');
        if (!$current) {
            return true; // Assume current if we can't check
        }
        
        return version_compare($GLOBALS['wp_version'], $current->updates[0]->current, '>=');
    }
    
    private function get_admin_username() {
        $admin_user = get_user_by('login', 'admin');
        return $admin_user ? 'admin' : 'not_admin';
    }
    
    private function get_failed_logins() {
        // This would need to be implemented with a login tracking system
        return 0;
    }
    
    private function check_file_permissions() {
        $critical_files = array(
            'wp-config.php' => 0400,
            '.htaccess' => 0444,
            'wp-content' => 0755
        );
        
        $results = array();
        foreach ($critical_files as $file => $expected_permission) {
            $file_path = ABSPATH . $file;
            if (file_exists($file_path)) {
                $permission = substr(sprintf('%o', fileperms($file_path)), -4);
                $results[$file] = array(
                    'current' => $permission,
                    'expected' => $expected_permission,
                    'secure' => $permission <= $expected_permission
                );
            }
        }
        
        return $results;
    }
    
    private function check_plugin_vulnerabilities() {
        // This would integrate with a vulnerability database
        return array();
    }
    
    private function check_theme_vulnerabilities() {
        // This would integrate with a vulnerability database
        return array();
    }
    
    private function get_backup_size() {
        $backup_dir = WP_CONTENT_DIR . '/wpma-backups/';
        if (!is_dir($backup_dir)) {
            return 0;
        }
        
        $size = 0;
        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($backup_dir));
        foreach ($files as $file) {
            if ($file->isFile()) {
                $size += $file->getSize();
            }
        }
        
        return round($size / 1024 / 1024, 2); // Convert to MB
    }
    
    private function get_backup_files() {
        $backup_dir = WP_CONTENT_DIR . '/wpma-backups/';
        if (!is_dir($backup_dir)) {
            return array();
        }
        
        $files = array();
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($backup_dir));
        foreach ($iterator as $file) {
            if ($file->isFile()) {
                $files[] = array(
                    'name' => $file->getFilename(),
                    'size' => $file->getSize(),
                    'modified' => $file->getMTime()
                );
            }
        }
        
        return $files;
    }
    
    public function ajax_register_site() {
        check_ajax_referer('wpma_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }
        
        $api_key = sanitize_text_field($_POST['api_key']);
        $site_name = sanitize_text_field($_POST['site_name']);
        
        $response = $this->api_client->register_site($api_key, $site_name);
        
        if ($response && $response['success']) {
            update_option('wpma_api_key', $api_key);
            update_option('wpma_site_id', $response['data']['id']);
            update_option('wpma_site_name', $site_name);
            
            wp_send_json_success('Site successfully registered');
        } else {
            wp_send_json_error($response['error'] ?? 'Registration failed');
        }
    }
    
    public function ajax_exchange_token() {
        // Log the request
        error_log('WPMA: Token exchange requested from ' . $_SERVER['REMOTE_ADDR']);
        
        check_ajax_referer('wpma_setup_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            error_log('WPMA: Token exchange failed - unauthorized user');
            wp_send_json_error(array('message' => 'Nicht autorisiert. Nur Administratoren können diese Aktion ausführen.'));
            return;
        }
        
        $token = isset($_POST['token']) ? sanitize_text_field($_POST['token']) : '';
        
        if (empty($token)) {
            error_log('WPMA: Token exchange failed - empty token');
            wp_send_json_error(array('message' => 'Token ist erforderlich'));
            return;
        }
        
        error_log('WPMA: Exchanging token: ' . substr($token, 0, 10) . '...');
        
        // Exchange token for API key
        $response = $this->api_client->exchange_setup_token($token);
        
        error_log('WPMA: API Response: ' . json_encode($response));
        
        if ($response && isset($response['success']) && $response['success']) {
            // Store configuration
            update_option('wpma_api_key', $response['data']['apiKey']);
            update_option('wpma_site_id', $response['data']['siteId']);
            update_option('wpma_site_name', $response['data']['siteName']);
            update_option('wpma_needs_setup', false);
            update_option('wpma_configured_at', current_time('mysql'));
            
            error_log('WPMA: Token exchange successful for site ' . $response['data']['siteId']);
            
            wp_send_json_success(array(
                'siteName' => $response['data']['siteName'],
                'siteId' => $response['data']['siteId']
            ));
        } else {
            $error_message = 'Token-Austausch fehlgeschlagen';
            
            if (isset($response['error'])) {
                if (strpos($response['error'], 'already been used') !== false) {
                    $error_message = 'Dieser Token wurde bereits verwendet. Bitte generieren Sie einen neuen Token im Dashboard.';
                } elseif (strpos($response['error'], 'expired') !== false) {
                    $error_message = 'Dieser Token ist abgelaufen. Bitte generieren Sie einen neuen Token im Dashboard.';
                } elseif (strpos($response['error'], 'Invalid') !== false) {
                    $error_message = 'Ungültiger Token. Bitte überprüfen Sie Ihren Token und versuchen Sie es erneut.';
                } else {
                    $error_message = $response['error'];
                }
            }
            
            error_log('WPMA: Token exchange failed - ' . $error_message);
            wp_send_json_error(array('message' => $error_message));
        }
    }
    
    public function ajax_update_health() {
        check_ajax_referer('wpma_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }
        
        $this->run_health_check();
        wp_send_json_success('Health check completed');
    }
    
    public function admin_notices() {
        // Zeige keine Notice hier - Onboarding wird im Dashboard angezeigt
        // Die alte Warnung wurde entfernt für bessere UX
    }
    
    private function log($type, $message, $data = null) {
        global $wpdb;
        
        $wpdb->insert(
            $wpdb->prefix . 'wpma_logs',
            array(
                'log_type' => $type,
                'message' => $message,
                'data' => $data ? json_encode($data) : null
            ),
            array('%s', '%s', '%s')
        );
    }
} 