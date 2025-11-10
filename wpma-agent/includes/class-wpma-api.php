<?php

class WPMA_API {
    
    private $api_url;
    private $timeout = 30;
    
    public function __construct() {
        $this->api_url = WPMA_API_URL;
    }
    
    public function register_site($api_key, $site_name) {
        $data = array(
            'domain' => parse_url(get_site_url(), PHP_URL_HOST),
            'site_url' => get_site_url(),
            'site_name' => $site_name
        );
        
        return $this->make_request('POST', '/api/v1/sites', $data, $api_key);
    }
    
    public function update_health($site_id, $health_data) {
        $api_key = get_option('wpma_api_key');
        return $this->make_request('PUT', "/api/v1/sites/{$site_id}/health", $health_data, $api_key);
    }
    
    public function update_security($site_id, $security_data) {
        $api_key = get_option('wpma_api_key');
        return $this->make_request('POST', "/api/v1/security/{$site_id}/scan", $security_data, $api_key);
    }
    
    public function update_backup_status($site_id, $backup_data) {
        $api_key = get_option('wpma_api_key');
        return $this->make_request('POST', "/api/v1/backup/{$site_id}", $backup_data, $api_key);
    }
    
    public function get_site_status($site_id) {
        $api_key = get_option('wpma_api_key');
        return $this->make_request('GET', "/api/v1/sites/{$site_id}", null, $api_key);
    }
    
    public function create_backup($site_id, $backup_type = 'full') {
        $api_key = get_option('wpma_api_key');
        $data = array('backup_type' => $backup_type);
        return $this->make_request('POST', "/api/v1/backup/{$site_id}/create", $data, $api_key);
    }
    
    public function get_performance_metrics($site_id) {
        $api_key = get_option('wpma_api_key');
        return $this->make_request('GET', "/api/v1/performance/{$site_id}/metrics", null, $api_key);
    }
    
    public function send_performance_metrics($site_id, $metrics) {
        $api_key = get_option('wpma_api_key');
        return $this->make_request('POST', "/api/v1/performance/{$site_id}/metrics", $metrics, $api_key);
    }
    
    public function send_security_scan($site_id, $scan_data) {
        $api_key = get_option('wpma_api_key');
        return $this->make_request('POST', "/api/v1/security/{$site_id}/scan", $scan_data, $api_key);
    }
    
    public function get_ai_insights($site_id) {
        $api_key = get_option('wpma_api_key');
        return $this->make_request('GET', "/api/v1/ai/{$site_id}/insights", null, $api_key);
    }
    
    private function make_request($method, $endpoint, $data = null, $api_key = null) {
        $url = $this->api_url . $endpoint;
        
        $args = array(
            'method' => $method,
            'timeout' => $this->timeout,
            'headers' => array(
                'Content-Type' => 'application/json',
                'User-Agent' => 'WPMA-Agent/' . WPMA_VERSION
            )
        );
        
        if ($api_key) {
            $args['headers']['Authorization'] = 'Bearer ' . $api_key;
        }
        
        if ($data && in_array($method, array('POST', 'PUT', 'PATCH'))) {
            $args['body'] = json_encode($data);
        }
        
        $response = wp_remote_request($url, $args);
        
        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'error' => $response->get_error_message()
            );
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $json_response = json_decode($body, true);
        
        if ($status_code >= 200 && $status_code < 300) {
            return $json_response ?: array('success' => true);
        } else {
            return array(
                'success' => false,
                'error' => $json_response['error'] ?? 'HTTP ' . $status_code,
                'status_code' => $status_code
            );
        }
    }
    
    public function test_connection($api_key) {
        return $this->make_request('GET', '/health', null, $api_key);
    }
    
    public function exchange_setup_token($token) {
        return $this->make_request(
            'POST', 
            '/api/v1/sites/setup-token/exchange',
            array('token' => $token)
        );
    }
} 