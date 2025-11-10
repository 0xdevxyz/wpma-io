<?php

class WPMA_Performance {
    
    private $api_client;
    
    public function __construct() {
        $this->api_client = new WPMA_API();
        add_action('wp_footer', array($this, 'inject_performance_tracking'), 999);
        add_action('wp_ajax_nopriv_wpma_track_vitals', array($this, 'ajax_track_core_web_vitals'));
        add_action('wp_ajax_wpma_track_vitals', array($this, 'ajax_track_core_web_vitals'));
    }
    
    public function get_performance_metrics() {
        global $wpdb;
        
        return array(
            'page_load_time' => $this->get_page_load_time(),
            'memory_usage' => memory_get_usage(true),
            'memory_limit' => ini_get('memory_limit'),
            'php_version' => phpversion(),
            'database_queries' => get_num_queries(),
            'database_size' => $this->get_database_size(),
            'cache_hit_ratio' => $this->get_cache_hit_ratio(),
            'wordpress_version' => get_bloginfo('version'),
            'active_plugins' => count(get_option('active_plugins', array())),
            'theme' => wp_get_theme()->get('Name'),
            'timestamp' => current_time('mysql')
        );
    }
    
    private function get_page_load_time() {
        if (defined('WP_START_TIMESTAMP')) {
            return round((microtime(true) - WP_START_TIMESTAMP) * 1000);
        }
        return 0;
    }
    
    private function get_database_size() {
        global $wpdb;
        $result = $wpdb->get_var($wpdb->prepare(
            "SELECT SUM(data_length + index_length) FROM information_schema.TABLES WHERE table_schema = %s",
            DB_NAME
        ));
        return $result ? intval($result) : 0;
    }
    
    private function get_cache_hit_ratio() {
        global $wp_object_cache;
        if (!is_object($wp_object_cache)) return null;
        
        if (isset($wp_object_cache->cache_hits) && isset($wp_object_cache->cache_misses)) {
            $hits = $wp_object_cache->cache_hits;
            $misses = $wp_object_cache->cache_misses;
            $total = $hits + $misses;
            if ($total > 0) return round(($hits / $total) * 100, 2);
        }
        return null;
    }
    
    public function inject_performance_tracking() {
        if (is_admin()) return;
        ?>
        <script>
        (function() {
            if ('PerformanceObserver' in window) {
                const vitals = { lcp: 0, fid: 0, cls: 0 };
                
                try {
                    new PerformanceObserver((list) => {
                        const entries = list.getEntries();
                        const lastEntry = entries[entries.length - 1];
                        vitals.lcp = lastEntry.renderTime || lastEntry.loadTime;
                    }).observe({ entryTypes: ['largest-contentful-paint'] });
                } catch (e) {}
                
                try {
                    new PerformanceObserver((list) => {
                        list.getEntries().forEach((entry) => {
                            vitals.fid = entry.processingStart - entry.startTime;
                        });
                    }).observe({ entryTypes: ['first-input'] });
                } catch (e) {}
                
                try {
                    let clsValue = 0;
                    new PerformanceObserver((list) => {
                        for (const entry of list.getEntries()) {
                            if (!entry.hadRecentInput) clsValue += entry.value;
                        }
                        vitals.cls = clsValue;
                    }).observe({ entryTypes: ['layout-shift'] });
                } catch (e) {}
                
                setTimeout(() => {
                    if (vitals.lcp > 0 || vitals.fid > 0 || vitals.cls > 0) {
                        fetch('<?php echo admin_url('admin-ajax.php'); ?>', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: 'action=wpma_track_vitals&vitals=' + encodeURIComponent(JSON.stringify(vitals))
                        });
                    }
                }, 5000);
            }
        })();
        </script>
        <?php
    }
    
    public function ajax_track_core_web_vitals() {
        if (!isset($_POST['vitals'])) {
            wp_send_json_error('No vitals data');
            return;
        }
        
        $vitals = json_decode(stripslashes($_POST['vitals']), true);
        if (!$vitals) {
            wp_send_json_error('Invalid vitals data');
            return;
        }
        
        set_transient('wpma_core_web_vitals', $vitals, 3600);
        wp_send_json_success('Vitals tracked');
    }
    
    public function get_core_web_vitals() {
        $vitals = get_transient('wpma_core_web_vitals');
        return $vitals ?: array('lcp' => 0, 'fid' => 0, 'cls' => 0);
    }
    
    public function send_complete_metrics() {
        $site_id = get_option('wpma_site_id');
        if (!$site_id) return array('success' => false, 'error' => 'Site not configured');
        
        $metrics = $this->get_performance_metrics();
        $metrics['core_web_vitals'] = $this->get_core_web_vitals();
        
        return $this->api_client->send_performance_metrics($site_id, $metrics);
    }
    
    public function optimize_database() {
        global $wpdb;
        $tables = $wpdb->get_results('SHOW TABLES', ARRAY_N);
        $optimized = 0;
        
        foreach ($tables as $table) {
            if ($wpdb->query("OPTIMIZE TABLE {$table[0]}")) $optimized++;
        }
        
        return array('success' => true, 'message' => sprintf('%d tables optimized', $optimized));
    }
}

