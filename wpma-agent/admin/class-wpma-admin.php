<?php
/**
 * WPMA Admin - Nur für Scripts/Styles laden
 * Menü-Registrierung erfolgt in class-wpma-core.php
 */

class WPMA_Admin {
    
    public function __construct() {
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
    }
    
    public function enqueue_admin_scripts($hook) {
        if (strpos($hook, 'wpma-agent') === false) {
            return;
        }
        
        wp_enqueue_style('wpma-admin', WPMA_PLUGIN_URL . 'admin/css/admin.css', array(), WPMA_VERSION);
        wp_enqueue_script('wpma-admin', WPMA_PLUGIN_URL . 'admin/js/admin.js', array('jquery'), WPMA_VERSION, true);
        
        wp_localize_script('wpma-admin', 'wpmaAdmin', array(
            'ajaxurl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('wpma_nonce')
        ));
    }
}

