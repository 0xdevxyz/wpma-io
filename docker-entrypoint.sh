#!/bin/sh
# Startup script to create plugin if missing

echo "Checking for WPMA plugin..."

if [ ! -f /app/wpma-agent.zip ] && [ ! -f /app/wpma-agent-plugin.zip ]; then
    echo "Creating minimal WPMA plugin..."
    
    mkdir -p /tmp/wpma-agent/includes
    
    # Main plugin file
    cat > /tmp/wpma-agent/wpma-agent.php << 'EOF'
<?php
/**
 * Plugin Name: WPMA Agent
 * Description: WordPress Management Agent for WPMA.io - connects your WordPress site to WPMA dashboard
 * Version: 1.3.0
 * Author: WPMA Team
 * Author URI: https://wpma.io
 * Text Domain: wpma-agent
 */

if (!defined('ABSPATH')) exit;

define('WPMA_VERSION', '1.3.0');
define('WPMA_PLUGIN_DIR', plugin_dir_path(__FILE__));

require_once WPMA_PLUGIN_DIR . 'includes/api.php';
require_once WPMA_PLUGIN_DIR . 'includes/setup.php';

add_action('plugins_loaded', function() {
    if (is_admin()) {
        new WPMA_Setup();
    }
    new WPMA_API();
});
EOF

    # API Handler
    cat > /tmp/wpma-agent/includes/api.php << 'EOF'
<?php
class WPMA_API {
    public function __construct() {
        add_action('rest_api_init', [$this, 'register_routes']);
    }
    
    public function register_routes() {
        register_rest_route('wpma/v1', '/plugins', [
            'methods' => 'GET',
            'callback' => [$this, 'get_plugins'],
            'permission_callback' => [$this, 'check_api_key']
        ]);
        
        register_rest_route('wpma/v1', '/stats', [
            'methods' => 'GET',
            'callback' => [$this, 'get_stats'],
            'permission_callback' => [$this, 'check_api_key']
        ]);
    }
    
    public function check_api_key($request) {
        $api_key = $request->get_header('X-WPMA-API-Key');
        $stored_key = get_option('wpma_api_key');
        return $api_key && $api_key === $stored_key;
    }
    
    public function get_plugins() {
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        
        $all_plugins = get_plugins();
        $active_plugins = get_option('active_plugins', []);
        $plugins = [];
        
        foreach ($all_plugins as $path => $plugin) {
            $plugins[] = [
                'name' => $plugin['Name'],
                'slug' => dirname($path),
                'version' => $plugin['Version'],
                'status' => in_array($path, $active_plugins) ? 'active' : 'inactive'
            ];
        }
        
        return ['success' => true, 'data' => $plugins];
    }
    
    public function get_stats() {
        $stats = [
            'posts' => wp_count_posts()->publish,
            'pages' => wp_count_posts('page')->publish,
            'comments' => wp_count_comments()->approved,
            'users' => count_users()['total_users']
        ];
        
        return ['success' => true, 'data' => $stats];
    }
}
EOF

    # Setup Page
    cat > /tmp/wpma-agent/includes/setup.php << 'EOF'
<?php
class WPMA_Setup {
    public function __construct() {
        add_action('admin_menu', [$this, 'add_menu']);
        add_action('admin_init', [$this, 'handle_setup']);
    }
    
    public function add_menu() {
        add_options_page('WPMA Setup', 'WPMA', 'manage_options', 'wpma-setup', [$this, 'render_page']);
    }
    
    public function handle_setup() {
        if (isset($_GET['wpma_token'])) {
            $token = sanitize_text_field($_GET['wpma_token']);
            $api_key = wp_generate_password(32, false);
            update_option('wpma_api_key', $api_key);
            update_option('wpma_setup_token', $token);
            wp_redirect(admin_url('options-general.php?page=wpma-setup&success=1'));
            exit;
        }
    }
    
    public function render_page() {
        $api_key = get_option('wpma_api_key');
        echo '<div class="wrap">';
        echo '<h1>WPMA Setup</h1>';
        
        if ($api_key) {
            echo '<div class="notice notice-success"><p>✓ Verbindung hergestellt!</p></div>';
            echo '<p>API Key: <code>' . esc_html($api_key) . '</code></p>';
        } else {
            echo '<div class="notice notice-warning"><p>Noch nicht verbunden.</p></div>';
        }
        
        echo '</div>';
    }
}
EOF

    # Create ZIP
    cd /tmp && zip -r -q wpma-agent.zip wpma-agent/ && cd /app
    mv /tmp/wpma-agent.zip /app/wpma-agent.zip
    ln -sf /app/wpma-agent.zip /app/wpma-agent-plugin.zip
    
    echo "✓ WPMA plugin created successfully"
else
    echo "✓ WPMA plugin already exists"
fi

# Start application
exec npm start
