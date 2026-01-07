<?php
/**
 * WPMA Updates - Sendet Update-Informationen an WPMA.io
 * 
 * @package WPMA_Agent
 * @since 1.1.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPMA_Updates {
    
    private $api_client;
    
    public function __construct() {
        $this->api_client = new WPMA_API();
        
        // Hook für Update-Check
        add_action('wpma_check_updates', array($this, 'check_and_send_updates'));
        
        // Hook wenn Updates verfügbar werden
        add_action('set_site_transient_update_plugins', array($this, 'on_update_check'), 10, 1);
        add_action('set_site_transient_update_themes', array($this, 'on_update_check'), 10, 1);
        add_action('set_site_transient_update_core', array($this, 'on_update_check'), 10, 1);
        
        // AJAX Handler für manuelle Update-Prüfung
        add_action('wp_ajax_wpma_check_updates', array($this, 'ajax_check_updates'));
        add_action('wp_ajax_wpma_trigger_auto_update', array($this, 'ajax_trigger_auto_update'));
    }
    
    /**
     * Sammelt alle verfügbaren Updates
     */
    public function get_available_updates() {
        // Stelle sicher, dass Update-Funktionen geladen sind
        if (!function_exists('get_plugin_updates')) {
            require_once ABSPATH . 'wp-admin/includes/update.php';
        }
        if (!function_exists('get_core_updates')) {
            require_once ABSPATH . 'wp-admin/includes/update.php';
        }
        
        // WordPress Core Updates
        $core_updates = get_core_updates();
        $core_update = null;
        if (!empty($core_updates) && isset($core_updates[0]->response) && $core_updates[0]->response === 'upgrade') {
            $core_update = array(
                'current' => get_bloginfo('version'),
                'new' => $core_updates[0]->current,
                'download_url' => $core_updates[0]->download ?? ''
            );
        }
        
        // Plugin Updates
        $plugin_updates = get_plugin_updates();
        $plugins = array();
        foreach ($plugin_updates as $plugin_file => $plugin_data) {
            $plugin_info = get_plugin_data(WP_PLUGIN_DIR . '/' . $plugin_file);
            $plugins[] = array(
                'name' => $plugin_info['Name'],
                'slug' => dirname($plugin_file),
                'file' => $plugin_file,
                'current_version' => $plugin_info['Version'],
                'new_version' => $plugin_data->update->new_version,
                'requires_php' => $plugin_data->update->requires_php ?? null,
                'requires_wp' => $plugin_data->update->requires ?? null,
                'compatible_php' => $this->check_php_compatibility($plugin_data->update->requires_php ?? null),
                'compatible_wp' => $this->check_wp_compatibility($plugin_data->update->requires ?? null)
            );
        }
        
        // Theme Updates
        $theme_updates = get_theme_updates();
        $themes = array();
        foreach ($theme_updates as $stylesheet => $theme) {
            $themes[] = array(
                'name' => $theme->get('Name'),
                'slug' => $stylesheet,
                'current_version' => $theme->get('Version'),
                'new_version' => $theme->update['new_version'] ?? 'Unbekannt'
            );
        }
        
        return array(
            'core' => $core_update,
            'plugins' => $plugins,
            'themes' => $themes,
            'total' => count($plugins) + count($themes) + ($core_update ? 1 : 0),
            'timestamp' => current_time('mysql'),
            'wordpress_version' => get_bloginfo('version'),
            'php_version' => phpversion()
        );
    }
    
    /**
     * Prüft PHP-Kompatibilität
     */
    private function check_php_compatibility($required_php) {
        if (empty($required_php)) {
            return true;
        }
        return version_compare(phpversion(), $required_php, '>=');
    }
    
    /**
     * Prüft WordPress-Kompatibilität
     */
    private function check_wp_compatibility($required_wp) {
        if (empty($required_wp)) {
            return true;
        }
        return version_compare(get_bloginfo('version'), $required_wp, '>=');
    }
    
    /**
     * Sendet Update-Informationen an WPMA.io
     */
    public function check_and_send_updates() {
        $site_id = get_option('wpma_site_id');
        if (!$site_id) {
            return;
        }
        
        $updates = $this->get_available_updates();
        
        // Sende an API
        $response = $this->api_client->send_updates($site_id, $updates);
        
        if ($response && isset($response['success']) && $response['success']) {
            update_option('wpma_last_update_check', current_time('mysql'));
            
            // Prüfe ob Auto-Update empfohlen wird
            if (isset($response['data']['can_auto_update']) && $response['data']['can_auto_update']) {
                $this->maybe_auto_update($response['data']);
            }
        }
        
        return $updates;
    }
    
    /**
     * Führt Auto-Updates durch wenn von KI empfohlen
     */
    private function maybe_auto_update($recommendation) {
        // Prüfe ob Auto-Updates aktiviert sind
        $auto_update_enabled = get_option('wpma_auto_update_enabled', false);
        
        if (!$auto_update_enabled) {
            return;
        }
        
        // Nur bei niedrigem Risiko automatisch updaten
        if ($recommendation['risk_level'] !== 'low') {
            $this->log_update_skipped($recommendation);
            return;
        }
        
        // Erstelle Backup vor Update
        if ($recommendation['requires_backup']) {
            $this->create_backup_before_update();
        }
        
        // Führe Updates durch
        $this->perform_updates();
    }
    
    /**
     * Führt die eigentlichen Updates durch
     */
    private function perform_updates() {
        // Verwende WordPress Auto-Update Funktion
        include_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        include_once ABSPATH . 'wp-admin/includes/file.php';
        include_once ABSPATH . 'wp-admin/includes/plugin.php';
        
        // Plugin Updates
        $plugin_updates = get_plugin_updates();
        foreach ($plugin_updates as $plugin_file => $plugin_data) {
            // Update Plugin
            $upgrader = new Plugin_Upgrader(new Automatic_Upgrader_Skin());
            $result = $upgrader->upgrade($plugin_file);
            
            if (is_wp_error($result)) {
                $this->log_update_error($plugin_file, $result->get_error_message());
            } else {
                $this->log_update_success($plugin_file);
            }
        }
        
        // Theme Updates
        $theme_updates = get_theme_updates();
        foreach ($theme_updates as $stylesheet => $theme) {
            $upgrader = new Theme_Upgrader(new Automatic_Upgrader_Skin());
            $result = $upgrader->upgrade($stylesheet);
            
            if (is_wp_error($result)) {
                $this->log_update_error($stylesheet, $result->get_error_message());
            } else {
                $this->log_update_success($stylesheet);
            }
        }
        
        // Sende Update-Report an WPMA.io
        $this->send_update_report();
    }
    
    /**
     * Erstellt ein Backup vor dem Update
     */
    private function create_backup_before_update() {
        // Trigger Backup über WPMA Backup-System
        $backup = new WPMA_Backup();
        $backup->create_backup('pre_update');
    }
    
    /**
     * Logging-Funktionen
     */
    private function log_update_success($item) {
        $this->log('update_success', sprintf('Update erfolgreich: %s', $item));
    }
    
    private function log_update_error($item, $error) {
        $this->log('update_error', sprintf('Update fehlgeschlagen für %s: %s', $item, $error));
    }
    
    private function log_update_skipped($recommendation) {
        $this->log('update_skipped', sprintf('Auto-Update übersprungen - Risiko: %s', $recommendation['risk_level']));
    }
    
    private function log($type, $message) {
        global $wpdb;
        $wpdb->insert(
            $wpdb->prefix . 'wpma_logs',
            array(
                'log_type' => $type,
                'message' => $message,
                'created_at' => current_time('mysql')
            )
        );
    }
    
    /**
     * Sendet Update-Report an WPMA.io
     */
    private function send_update_report() {
        $site_id = get_option('wpma_site_id');
        if (!$site_id) {
            return;
        }
        
        // Hole aktuelle Update-Logs
        global $wpdb;
        $logs = $wpdb->get_results(
            "SELECT * FROM {$wpdb->prefix}wpma_logs 
             WHERE log_type IN ('update_success', 'update_error') 
             AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
             ORDER BY created_at DESC"
        );
        
        $this->api_client->send_update_report($site_id, $logs);
    }
    
    /**
     * Hook wenn Updates geprüft werden
     */
    public function on_update_check($value) {
        // Debounce - nicht zu oft senden
        $last_sent = get_transient('wpma_updates_sent');
        if ($last_sent) {
            return $value;
        }
        
        // Markiere als gesendet (für 5 Minuten)
        set_transient('wpma_updates_sent', true, 300);
        
        // Asynchron Updates senden
        wp_schedule_single_event(time(), 'wpma_check_updates');
        
        return $value;
    }
    
    /**
     * AJAX: Manuelle Update-Prüfung
     */
    public function ajax_check_updates() {
        check_ajax_referer('wpma_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Nicht autorisiert');
            return;
        }
        
        $updates = $this->check_and_send_updates();
        
        wp_send_json_success(array(
            'updates' => $updates,
            'message' => sprintf('%d Updates verfügbar', $updates['total'])
        ));
    }
    
    /**
     * AJAX: Auto-Update manuell triggern
     */
    public function ajax_trigger_auto_update() {
        check_ajax_referer('wpma_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Nicht autorisiert');
            return;
        }
        
        // Hole KI-Empfehlung
        $site_id = get_option('wpma_site_id');
        $updates = $this->get_available_updates();
        
        // Sende an API für Analyse
        $response = $this->api_client->request_update_analysis($site_id, $updates);
        
        if ($response && isset($response['success']) && $response['success']) {
            if ($response['data']['can_auto_update']) {
                $this->perform_updates();
                wp_send_json_success(array(
                    'message' => 'Updates wurden durchgeführt',
                    'performed' => true
                ));
            } else {
                wp_send_json_success(array(
                    'message' => 'Auto-Update nicht empfohlen: ' . ($response['data']['recommendation'] ?? 'Manuelle Prüfung erforderlich'),
                    'performed' => false,
                    'reason' => $response['data']['recommendation']
                ));
            }
        } else {
            wp_send_json_error('Konnte KI-Analyse nicht durchführen');
        }
    }
}

