<?php
/**
 * Plugin Name: WPMA Agent
 * Plugin URI: https://wpma.io
 * Description: WordPress Management AI Agent für proaktive Wartung, Sicherheit und Performance-Optimierung
 * Version: 1.3.0
 * Author: WPMA.io
 * License: GPL v2 or later
 * Text Domain: wpma-agent
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('WPMA_VERSION', '1.3.0');
define('WPMA_PLUGIN_URL', plugin_dir_url(__FILE__));
define('WPMA_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('WPMA_API_URL', 'https://api.wpma.io');

// Include required files
require_once WPMA_PLUGIN_PATH . 'includes/class-wpma-core.php';
require_once WPMA_PLUGIN_PATH . 'includes/class-wpma-security.php';
require_once WPMA_PLUGIN_PATH . 'includes/class-wpma-backup.php';
require_once WPMA_PLUGIN_PATH . 'includes/class-wpma-performance.php';
require_once WPMA_PLUGIN_PATH . 'includes/class-wpma-api.php';
require_once WPMA_PLUGIN_PATH . 'includes/class-wpma-updates.php';
require_once WPMA_PLUGIN_PATH . 'admin/class-wpma-admin.php';

// Initialize the plugin
function wpma_init() {
    global $wpma_core, $wpma_updates, $wpma_backup;
    
    $wpma_core = new WPMA_Core();
    $wpma_core->init();
    
    // Initialize Updates module
    $wpma_updates = new WPMA_Updates();
    
    // Initialize Backup module (mit REST API)
    $wpma_backup = new WPMA_Backup();
    $wpma_backup->init();
    
    // Initialize admin
    if (is_admin()) {
        new WPMA_Admin();
    }
}
add_action('plugins_loaded', 'wpma_init');

// Add AJAX handlers for security scan and performance
add_action('wp_ajax_wpma_run_security_scan', 'wpma_ajax_security_scan');
function wpma_ajax_security_scan() {
    check_ajax_referer('wpma_nonce', 'nonce');
    
    if (!current_user_can('manage_options')) {
        wp_send_json_error('Nicht autorisiert');
        return;
    }
    
    $security = new WPMA_Security();
    $result = $security->send_security_scan();
    
    if ($result && isset($result['success']) && $result['success']) {
        update_option('wpma_last_security_scan', current_time('mysql'));
        wp_send_json_success('Security Scan erfolgreich');
    } else {
        wp_send_json_error($result['error'] ?? 'Scan fehlgeschlagen');
    }
}

add_action('wp_ajax_wpma_update_performance', 'wpma_ajax_performance_check');
function wpma_ajax_performance_check() {
    check_ajax_referer('wpma_nonce', 'nonce');
    
    if (!current_user_can('manage_options')) {
        wp_send_json_error('Nicht autorisiert');
        return;
    }
    
    $performance = new WPMA_Performance();
    $result = $performance->send_complete_metrics();
    
    if ($result && isset($result['success']) && $result['success']) {
        wp_send_json_success('Performance-Daten gesendet');
    } else {
        wp_send_json_error($result['error'] ?? 'Fehler beim Senden');
    }
}

add_action('wp_ajax_wpma_test_connection', 'wpma_ajax_test_connection');
function wpma_ajax_test_connection() {
    check_ajax_referer('wpma_nonce', 'nonce');
    
    if (!current_user_can('manage_options')) {
        wp_send_json_error('Nicht autorisiert');
        return;
    }
    
    $api_client = new WPMA_API();
    $api_key = get_option('wpma_api_key');
    $result = $api_client->test_connection($api_key);
    
    if ($result && isset($result['status']) && $result['status'] === 'healthy') {
        wp_send_json_success('Verbindung erfolgreich!');
    } else {
        wp_send_json_error('Verbindung fehlgeschlagen: ' . ($result['error'] ?? 'Unbekannter Fehler'));
    }
}

// Show success notice after automatic setup
add_action('admin_notices', 'wpma_setup_success_notice');
function wpma_setup_success_notice() {
    if (get_transient('wpma_setup_success')) {
        $site_name = get_option('wpma_site_name', 'Ihre Site');
        ?>
        <div class="notice notice-success is-dismissible">
            <p>
                <strong>WPMA Agent erfolgreich konfiguriert!</strong><br>
                Ihre WordPress-Site "<?php echo esc_html($site_name); ?>" ist jetzt mit WPMA.io verbunden und wird automatisch überwacht.
            </p>
        </div>
        <?php
        delete_transient('wpma_setup_success');
    }
}

// Activation hook
register_activation_hook(__FILE__, 'wpma_activate');
function wpma_activate() {
    // Create necessary database tables
    WPMA_Core::create_tables();
    
    // Schedule cron jobs
    if (!wp_next_scheduled('wpma_health_check')) {
        wp_schedule_event(time(), 'hourly', 'wpma_health_check');
    }
    if (!wp_next_scheduled('wpma_security_scan')) {
        wp_schedule_event(time(), 'daily', 'wpma_security_scan');
    }
    if (!wp_next_scheduled('wpma_backup_check')) {
        wp_schedule_event(time(), 'daily', 'wpma_backup_check');
    }
    if (!wp_next_scheduled('wpma_performance_check')) {
        wp_schedule_event(time(), 'hourly', 'wpma_performance_check');
    }
    
    // Check for setup token in URL or session
    wpma_try_auto_setup();
}

// Try automatic setup with token
function wpma_try_auto_setup() {
    // Check if already configured
    if (get_option('wpma_api_key')) {
        return;
    }
    
    // Set flag to show setup wizard
    update_option('wpma_needs_setup', true);
}

// Deactivation hook
register_deactivation_hook(__FILE__, 'wpma_deactivate');
function wpma_deactivate() {
    // Clear scheduled events
    wp_clear_scheduled_hook('wpma_health_check');
    wp_clear_scheduled_hook('wpma_security_scan');
    wp_clear_scheduled_hook('wpma_backup_check');
    wp_clear_scheduled_hook('wpma_performance_check');
}

// Uninstall hook
register_uninstall_hook(__FILE__, 'wpma_uninstall');
function wpma_uninstall() {
    // Clean up database tables
    global $wpdb;
    $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}wpma_settings");
    $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}wpma_logs");
} 