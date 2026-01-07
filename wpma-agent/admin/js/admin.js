/**
 * WPMA Agent Admin JavaScript
 * Version: 1.0.0
 */

(function($) {
    'use strict';

    // Wait for DOM ready
    $(document).ready(function() {
        initWPMAAdmin();
    });

    function initWPMAAdmin() {
        // Bind action buttons
        bindActionButtons();
        
        // Initialize tooltips
        initTooltips();
        
        // Auto-refresh dashboard
        initAutoRefresh();
    }

    /**
     * Bind click handlers for action buttons
     */
    function bindActionButtons() {
        // Health Check
        $('#wpma-health-check, #wpma-run-health-check').on('click', function(e) {
            e.preventDefault();
            performAction('wpma_update_health', $(this), 'Health Check');
        });

        // Security Scan
        $('#wpma-security-scan, #wpma-run-security-scan').on('click', function(e) {
            e.preventDefault();
            performAction('wpma_run_security_scan', $(this), 'Security Scan');
        });

        // Performance Check
        $('#wpma-performance-check').on('click', function(e) {
            e.preventDefault();
            performAction('wpma_update_performance', $(this), 'Performance Check');
        });

        // Test Connection
        $('#wpma-test-connection').on('click', function(e) {
            e.preventDefault();
            performAction('wpma_test_connection', $(this), 'Verbindungstest');
        });
    }

    /**
     * Perform an AJAX action
     */
    function performAction(action, $button, label) {
        var originalHtml = $button.html();
        var $resultContainer = $('#wpma-action-result');

        // Disable button and show loading state
        $button.prop('disabled', true).addClass('wpma-loading');
        $button.html('<span class="dashicons dashicons-update-alt wpma-spinner"></span> ' + label + '...');

        $.ajax({
            url: wpmaAdmin.ajaxurl,
            type: 'POST',
            data: {
                action: action,
                nonce: wpmaAdmin.nonce
            },
            success: function(response) {
                if (response.success) {
                    showNotice('success', '✓ ' + label + ' erfolgreich abgeschlossen.', $resultContainer);
                    
                    // Update last check time if applicable
                    updateLastCheckTime(action);
                } else {
                    var errorMsg = response.data || 'Unbekannter Fehler';
                    showNotice('error', '✗ ' + label + ' fehlgeschlagen: ' + errorMsg, $resultContainer);
                }
            },
            error: function(xhr, status, error) {
                showNotice('error', '✗ Netzwerkfehler: ' + error, $resultContainer);
            },
            complete: function() {
                // Restore button state
                $button.prop('disabled', false).removeClass('wpma-loading');
                $button.html(originalHtml);
            }
        });
    }

    /**
     * Show a notice message
     */
    function showNotice(type, message, $container) {
        var noticeClass = type === 'success' ? 'notice-success' : 'notice-error';
        var $notice = $('<div class="notice ' + noticeClass + ' is-dismissible"><p>' + message + '</p></div>');
        
        if ($container && $container.length) {
            $container.html($notice);
        } else {
            $('.wrap h1').first().after($notice);
        }

        // Auto-dismiss after 5 seconds
        setTimeout(function() {
            $notice.fadeOut(function() {
                $(this).remove();
            });
        }, 5000);
    }

    /**
     * Update the last check time display
     */
    function updateLastCheckTime(action) {
        var now = new Date();
        var timeString = now.toLocaleString('de-DE');
        
        switch(action) {
            case 'wpma_update_health':
                $('.wpma-last-health-check').text('Letzter Check: ' + timeString);
                break;
            case 'wpma_run_security_scan':
                $('.wpma-last-security-scan').text('Letzter Scan: ' + timeString);
                break;
        }
    }

    /**
     * Initialize tooltips
     */
    function initTooltips() {
        $('[data-wpma-tooltip]').each(function() {
            var $el = $(this);
            var tooltip = $el.data('wpma-tooltip');
            
            $el.attr('title', tooltip);
        });
    }

    /**
     * Initialize auto-refresh for dashboard metrics
     */
    function initAutoRefresh() {
        // Refresh metrics every 5 minutes on the dashboard
        if ($('.wpma-dashboard').length) {
            setInterval(function() {
                refreshDashboardMetrics();
            }, 300000); // 5 minutes
        }
    }

    /**
     * Refresh dashboard metrics via AJAX
     */
    function refreshDashboardMetrics() {
        $.ajax({
            url: wpmaAdmin.ajaxurl,
            type: 'POST',
            data: {
                action: 'wpma_get_dashboard_metrics',
                nonce: wpmaAdmin.nonce
            },
            success: function(response) {
                if (response.success && response.data) {
                    updateDashboardUI(response.data);
                }
            }
        });
    }

    /**
     * Update dashboard UI with new metrics
     */
    function updateDashboardUI(data) {
        if (data.performance) {
            $('.wpma-metric-load-time .wpma-metric-value').text(data.performance.page_load_time + ' ms');
            $('.wpma-metric-memory .wpma-metric-value').text(data.performance.memory_usage);
            $('.wpma-metric-queries .wpma-metric-value').text(data.performance.database_queries);
        }
        
        if (data.vitals) {
            updateVitalScore('lcp', data.vitals.lcp);
            updateVitalScore('fid', data.vitals.fid);
            updateVitalScore('cls', data.vitals.cls);
        }
    }

    /**
     * Update a Core Web Vital score display
     */
    function updateVitalScore(metric, value) {
        var $el = $('.wpma-vital-' + metric + ' .wpma-vital-value');
        if (!$el.length) return;

        var scoreClass = 'good';
        
        switch(metric) {
            case 'lcp':
                scoreClass = value <= 2500 ? 'good' : (value <= 4000 ? 'needs-improvement' : 'poor');
                $el.text(value > 0 ? Math.round(value) + ' ms' : '-');
                break;
            case 'fid':
                scoreClass = value <= 100 ? 'good' : (value <= 300 ? 'needs-improvement' : 'poor');
                $el.text(value > 0 ? Math.round(value) + ' ms' : '-');
                break;
            case 'cls':
                scoreClass = value <= 0.1 ? 'good' : (value <= 0.25 ? 'needs-improvement' : 'poor');
                $el.text(value > 0 ? value.toFixed(3) : '-');
                break;
        }
        
        $el.removeClass('good needs-improvement poor').addClass(scoreClass);
    }

    // Expose API for external use
    window.WPMAAdmin = {
        performAction: performAction,
        showNotice: showNotice,
        refreshDashboardMetrics: refreshDashboardMetrics
    };

})(jQuery);

