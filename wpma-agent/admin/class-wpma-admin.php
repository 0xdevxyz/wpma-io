<?php

class WPMA_Admin {
    
    public function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
    }
    
    public function add_admin_menu() {
        add_menu_page(
            'WPMA Agent',
            'WPMA Agent',
            'manage_options',
            'wpma-agent',
            array($this, 'render_main_page'),
            'dashicons-shield',
            30
        );
        
        add_submenu_page(
            'wpma-agent',
            'Settings',
            'Settings',
            'manage_options',
            'wpma-agent-settings',
            array($this, 'render_settings_page')
        );
    }
    
    public function render_main_page() {
        ?>
        <div class="wrap">
            <h1>WPMA Agent Dashboard</h1>
            <div class="card">
                <h2>Connection Status</h2>
                <?php
                $api_key = get_option('wpma_api_key');
                $site_name = get_option('wpma_site_name');
                
                if ($api_key) {
                    echo '<p style="color: green;">✓ Connected to WPMA.io</p>';
                    echo '<p><strong>Site Name:</strong> ' . esc_html($site_name) . '</p>';
                } else {
                    echo '<p style="color: orange;">⚠ Not connected</p>';
                    echo '<p><a href="' . admin_url('admin.php?page=wpma-agent-settings') . '">Configure now</a></p>';
                }
                ?>
            </div>
        </div>
        <?php
    }
    
    public function render_settings_page() {
        // Check if setup is needed
        $needs_setup = get_option('wpma_needs_setup', false);
        $api_key = get_option('wpma_api_key');
        
        if ($needs_setup && !$api_key) {
            include WPMA_PLUGIN_PATH . 'admin/views/setup-wizard.php';
        } else {
            include WPMA_PLUGIN_PATH . 'admin/views/settings.php';
        }
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

