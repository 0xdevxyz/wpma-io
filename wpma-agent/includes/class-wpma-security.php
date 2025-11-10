<?php

class WPMA_Security {
    
    private $api_client;
    
    public function __construct() {
        $this->api_client = new WPMA_API();
    }
    
    public function get_security_status() {
        return array(
            'scan_type' => 'full',
            'ssl_enabled' => is_ssl(),
            'debug_mode' => defined('WP_DEBUG') && WP_DEBUG,
            'file_edit_disabled' => defined('DISALLOW_FILE_EDIT') && DISALLOW_FILE_EDIT,
            'wordpress_version' => get_bloginfo('version'),
            'php_version' => phpversion(),
            'admin_username' => $this->check_admin_username(),
            'failed_logins' => $this->get_failed_logins(),
            'outdated_plugins' => $this->get_outdated_plugins(),
            'outdated_themes' => $this->get_outdated_themes(),
            'file_permissions' => $this->check_file_permissions(),
            'security_plugins' => $this->check_security_plugins(),
            'two_factor_enabled' => $this->check_two_factor(),
            'timestamp' => current_time('mysql')
        );
    }
    
    private function check_admin_username() {
        $admin_user = get_user_by('login', 'admin');
        return $admin_user ? 'admin' : 'safe';
    }
    
    private function get_failed_logins() {
        $failed_logins = get_transient('wpma_failed_logins');
        return $failed_logins ? intval($failed_logins) : 0;
    }
    
    private function get_outdated_plugins() {
        if (!function_exists('get_plugin_updates')) {
            require_once ABSPATH . 'wp-admin/includes/update.php';
        }
        
        $plugin_updates = get_plugin_updates();
        $outdated = array();
        
        foreach ($plugin_updates as $plugin_file => $plugin_data) {
            $plugin_info = get_plugin_data(WP_PLUGIN_DIR . '/' . $plugin_file);
            $outdated[] = array(
                'name' => $plugin_info['Name'],
                'current_version' => $plugin_info['Version'],
                'latest_version' => $plugin_data->update->new_version,
                'file' => $plugin_file
            );
        }
        
        return $outdated;
    }
    
    private function get_outdated_themes() {
        if (!function_exists('get_theme_updates')) {
            require_once ABSPATH . 'wp-admin/includes/update.php';
        }
        
        $theme_updates = get_theme_updates();
        $outdated = array();
        
        foreach ($theme_updates as $stylesheet => $theme) {
            $outdated[] = array(
                'name' => $theme->get('Name'),
                'current_version' => $theme->get('Version'),
                'stylesheet' => $stylesheet
            );
        }
        
        return $outdated;
    }
    
    private function check_file_permissions() {
        $files_to_check = array('wp-config.php', '.htaccess');
        $results = array();
        
        foreach ($files_to_check as $file) {
            $file_path = ABSPATH . $file;
            if (file_exists($file_path)) {
                $perms = fileperms($file_path);
                $results[$file] = array(
                    'exists' => true,
                    'permissions' => substr(sprintf('%o', $perms), -4),
                    'writable' => is_writable($file_path)
                );
            } else {
                $results[$file] = array('exists' => false);
            }
        }
        
        return $results;
    }
    
    private function check_security_plugins() {
        $security_plugins = array(
            'wordfence/wordfence.php' => 'Wordfence',
            'sucuri-scanner/sucuri.php' => 'Sucuri',
            'all-in-one-wp-security-and-firewall/wp-security.php' => 'All In One WP Security'
        );
        
        $installed = array();
        foreach ($security_plugins as $plugin_file => $plugin_name) {
            if (is_plugin_active($plugin_file)) {
                $installed[] = $plugin_name;
            }
        }
        
        return $installed;
    }
    
    private function check_two_factor() {
        $twofa_plugins = array(
            'two-factor/two-factor.php',
            'wordfence/wordfence.php',
            'google-authenticator/google-authenticator.php'
        );
        
        foreach ($twofa_plugins as $plugin) {
            if (is_plugin_active($plugin)) return true;
        }
        
        return false;
    }
    
    public function send_security_scan() {
        $site_id = get_option('wpma_site_id');
        if (!$site_id) return array('success' => false, 'error' => 'Site not configured');
        
        $scan_data = $this->get_security_status();
        $response = $this->api_client->send_security_scan($site_id, $scan_data);
        
        if ($response && isset($response['success']) && $response['success']) {
            update_option('wpma_last_security_scan', current_time('mysql'));
            return array('success' => true, 'message' => 'Security scan sent successfully');
        }
        
        return array('success' => false, 'error' => 'Failed to send security scan');
    }
    
    public function perform_full_scan() {
        $start_time = microtime(true);
        $scan_results = $this->get_security_status();
        $scan_results['scan_duration'] = round((microtime(true) - $start_time) * 1000);
        return $scan_results;
    }
}

