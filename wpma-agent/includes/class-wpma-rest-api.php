<?php
/**
 * WPMA REST API Endpoints
 * Stellt REST API Endpoints für das WPMA Dashboard bereit
 */

class WPMA_REST_API {
    
    public function __construct() {
        add_action('rest_api_init', array($this, 'register_rest_routes'));
    }
    
    public function register_rest_routes() {
        // Plugin Liste
        register_rest_route('wpma/v1', '/plugins', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_plugins'),
            'permission_callback' => array($this, 'check_api_key')
        ));
        
        // Theme Liste
        register_rest_route('wpma/v1', '/themes', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_themes'),
            'permission_callback' => array($this, 'check_api_key')
        ));
        
        // Core Updates
        register_rest_route('wpma/v1', '/core-update', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_core_update'),
            'permission_callback' => array($this, 'check_api_key')
        ));
        
        // Site Stats
        register_rest_route('wpma/v1', '/stats', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_stats'),
            'permission_callback' => array($this, 'check_api_key')
        ));
        
        // Security Check
        register_rest_route('wpma/v1', '/security-check', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_security_check'),
            'permission_callback' => array($this, 'check_api_key')
        ));
        
        // Performance Metrics
        register_rest_route('wpma/v1', '/performance', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_performance'),
            'permission_callback' => array($this, 'check_api_key')
        ));
        
        // Screenshot
        register_rest_route('wpma/v1', '/screenshot', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_screenshot'),
            'permission_callback' => array($this, 'check_api_key')
        ));
    }
    
    /**
     * Prüft den API Key aus dem Header
     */
    public function check_api_key($request) {
        $api_key_header = $request->get_header('X-WPMA-API-Key');
        $stored_api_key = get_option('wpma_api_key');
        
        if (empty($stored_api_key)) {
            return new WP_Error('no_api_key', 'API-Key nicht konfiguriert', array('status' => 401));
        }
        
        if ($api_key_header !== $stored_api_key) {
            return new WP_Error('invalid_api_key', 'Ungültiger API-Key', array('status' => 403));
        }
        
        return true;
    }
    
    /**
     * GET /wpma/v1/plugins
     * Liefert alle installierten Plugins
     */
    public function get_plugins($request) {
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        
        $all_plugins = get_plugins();
        $active_plugins = get_option('active_plugins', array());
        $update_plugins = get_site_transient('update_plugins');
        
        $plugins = array();
        foreach ($all_plugins as $plugin_file => $plugin_data) {
            $is_active = in_array($plugin_file, $active_plugins);
            $has_update = isset($update_plugins->response[$plugin_file]);
            
            $plugins[] = array(
                'slug' => dirname($plugin_file),
                'file' => $plugin_file,
                'name' => $plugin_data['Name'],
                'version' => $plugin_data['Version'],
                'author' => $plugin_data['Author'],
                'author_uri' => $plugin_data['AuthorURI'],
                'description' => $plugin_data['Description'],
                'plugin_uri' => $plugin_data['PluginURI'],
                'is_active' => $is_active,
                'is_network_active' => is_plugin_active_for_network($plugin_file),
                'update_available' => $has_update,
                'new_version' => $has_update ? $update_plugins->response[$plugin_file]->new_version : null,
                'requires_wp' => $plugin_data['RequiresWP'] ?? null,
                'requires_php' => $plugin_data['RequiresPHP'] ?? null,
            );
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'data' => $plugins,
            'total' => count($all_plugins),
            'active' => count($active_plugins),
            'updates' => isset($update_plugins->response) ? count($update_plugins->response) : 0
        ));
    }
    
    /**
     * GET /wpma/v1/themes
     * Liefert alle installierten Themes
     */
    public function get_themes($request) {
        $all_themes = wp_get_themes();
        $current_theme = wp_get_theme();
        $update_themes = get_site_transient('update_themes');
        
        $themes = array();
        foreach ($all_themes as $theme_slug => $theme_obj) {
            $is_active = ($theme_slug === $current_theme->get_stylesheet());
            $has_update = isset($update_themes->response[$theme_slug]);
            
            $themes[] = array(
                'slug' => $theme_slug,
                'name' => $theme_obj->get('Name'),
                'version' => $theme_obj->get('Version'),
                'author' => $theme_obj->get('Author'),
                'author_uri' => $theme_obj->get('AuthorURI'),
                'description' => $theme_obj->get('Description'),
                'theme_uri' => $theme_obj->get('ThemeURI'),
                'template' => $theme_obj->get('Template'),
                'is_active' => $is_active,
                'update_available' => $has_update,
                'new_version' => $has_update ? $update_themes->response[$theme_slug]['new_version'] : null,
                'screenshot' => $theme_obj->get_screenshot()
            );
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'data' => $themes,
            'total' => count($all_themes),
            'active' => $current_theme->get('Name'),
            'updates' => isset($update_themes->response) ? count($update_themes->response) : 0
        ));
    }
    
    /**
     * GET /wpma/v1/core-update
     * Prüft auf WordPress Core Updates
     */
    public function get_core_update($request) {
        if (!function_exists('get_core_updates')) {
            require_once ABSPATH . 'wp-admin/includes/update.php';
        }
        
        $updates = get_core_updates();
        $current_version = get_bloginfo('version');
        
        $has_update = false;
        $new_version = null;
        
        if (!empty($updates) && isset($updates[0]->response) && $updates[0]->response === 'upgrade') {
            $has_update = true;
            $new_version = $updates[0]->version;
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'data' => array(
                'current_version' => $current_version,
                'update_available' => $has_update,
                'new_version' => $new_version,
                'php_version' => PHP_VERSION,
                'mysql_version' => $GLOBALS['wpdb']->db_version()
            )
        ));
    }
    
    /**
     * GET /wpma/v1/stats
     * Site-Statistiken
     */
    public function get_stats($request) {
        $posts_count = wp_count_posts('post');
        $pages_count = wp_count_posts('page');
        $comments_count = wp_count_comments();
        $users_count = count_users();
        
        // Disk Usage (optional, kann langsam sein)
        $upload_dir = wp_upload_dir();
        $disk_usage = 0;
        if (file_exists($upload_dir['basedir'])) {
            $disk_usage = $this->get_directory_size($upload_dir['basedir']);
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'data' => array(
                'posts' => $posts_count->publish ?? 0,
                'pages' => $pages_count->publish ?? 0,
                'comments' => $comments_count->approved ?? 0,
                'users' => $users_count['total_users'] ?? 0,
                'disk_usage' => $disk_usage,
                'disk_usage_mb' => round($disk_usage / 1024 / 1024, 2)
            )
        ));
    }
    
    /**
     * GET /wpma/v1/security-check
     * Basic Security Check
     */
    public function get_security_check($request) {
        $security = new WPMA_Security();
        
        $issues = array();
        $score = 100;
        
        // SSL Check
        if (!is_ssl()) {
            $issues[] = array(
                'severity' => 'high',
                'title' => 'Kein SSL',
                'description' => 'Website ist nicht über HTTPS erreichbar'
            );
            $score -= 30;
        }
        
        // WordPress Version
        $core_updates = get_core_updates();
        if (!empty($core_updates) && isset($core_updates[0]->response) && $core_updates[0]->response === 'upgrade') {
            $issues[] = array(
                'severity' => 'medium',
                'title' => 'WordPress Update verfügbar',
                'description' => 'WordPress Core Update auf ' . $core_updates[0]->version . ' verfügbar'
            );
            $score -= 15;
        }
        
        // Plugin Updates
        $update_plugins = get_site_transient('update_plugins');
        if (isset($update_plugins->response) && count($update_plugins->response) > 0) {
            $issues[] = array(
                'severity' => 'medium',
                'title' => count($update_plugins->response) . ' Plugin-Updates verfügbar',
                'description' => 'Veraltete Plugins können Sicherheitslücken enthalten'
            );
            $score -= 10;
        }
        
        // File Permissions Check (wp-config.php)
        if (file_exists(ABSPATH . 'wp-config.php')) {
            $perms = fileperms(ABSPATH . 'wp-config.php') & 0777;
            if ($perms != 0400 && $perms != 0440 && $perms != 0600) {
                $issues[] = array(
                    'severity' => 'high',
                    'title' => 'wp-config.php Berechtigungen unsicher',
                    'description' => 'Dateirechte: ' . decoct($perms)
                );
                $score -= 20;
            }
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'data' => array(
                'score' => max(0, $score),
                'issues' => $issues,
                'last_check' => current_time('mysql')
            )
        ));
    }
    
    /**
     * GET /wpma/v1/performance
     * Performance Metriken
     */
    public function get_performance($request) {
        $performance = new WPMA_Performance();
        
        // DB Queries
        global $wpdb;
        $db_queries = $wpdb->num_queries;
        
        // Memory Usage
        $memory_usage = memory_get_usage(true);
        $memory_limit = ini_get('memory_limit');
        
        // DB Size
        $db_size = 0;
        $tables = $wpdb->get_results("SHOW TABLE STATUS", ARRAY_A);
        foreach ($tables as $table) {
            $db_size += $table['Data_length'] + $table['Index_length'];
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'data' => array(
                'memory_usage' => $memory_usage,
                'memory_usage_mb' => round($memory_usage / 1024 / 1024, 2),
                'memory_limit' => $memory_limit,
                'db_queries' => $db_queries,
                'db_size' => $db_size,
                'db_size_mb' => round($db_size / 1024 / 1024, 2),
                'php_version' => PHP_VERSION,
                'wp_version' => get_bloginfo('version')
            )
        ));
    }
    
    /**
     * Berechnet Verzeichnisgröße rekursiv
     */
    private function get_directory_size($directory) {
        $size = 0;
        
        if (!is_dir($directory)) {
            return 0;
        }
        
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, RecursiveDirectoryIterator::SKIP_DOTS)) as $file) {
            $size += $file->getSize();
        }
        
        return $size;
    }
    
    /**
     * GET /wpma/v1/screenshot
     * Generiert Screenshot der Homepage
     */
    public function get_screenshot($request) {
        $screenshot_url = get_option('wpma_screenshot_url', '');
        
        if (empty($screenshot_url)) {
            $screenshot_url = $this->generate_screenshot();
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'data' => array(
                'screenshot_url' => $screenshot_url,
                'generated_at' => get_option('wpma_screenshot_generated', current_time('mysql'))
            )
        ));
    }
    
    /**
     * Generiert Screenshot mit externer API
     */
    private function generate_screenshot() {
        $site_url = home_url();
        
        $screenshot_api = 'https://api.screenshotmachine.com/?key=demo&url=' . urlencode($site_url) . '&dimension=1024x768';
        
        set_transient('wpma_screenshot_url', $screenshot_api, HOUR_IN_SECONDS * 24);
        update_option('wpma_screenshot_url', $screenshot_api);
        update_option('wpma_screenshot_generated', current_time('mysql'));
        
        return $screenshot_api;
    }
}
