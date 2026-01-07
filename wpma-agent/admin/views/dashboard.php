<?php
if (!defined('ABSPATH')) {
    exit;
}

$api_key = get_option('wpma_api_key', '');
$site_id = get_option('wpma_site_id', '');
$site_name = get_option('wpma_site_name', get_bloginfo('name'));

// WordPress Admin Notices werden hier angezeigt (außerhalb des Plugin-Containers)
?>
<div class="wrap">
    <h1 style="display:none;">WPMA.io</h1>
    <?php 
    // Zeige alle Admin Notices an dieser Stelle
    do_action('admin_notices');
    ?>
</div>
<?php

// Wenn nicht verbunden, zeige Onboarding
if (!$api_key) {
    include WPMA_PLUGIN_PATH . 'admin/views/onboarding.php';
    return;
}

// Get current status
$security = new WPMA_Security();
$security_status = $security->get_security_status();

$performance = new WPMA_Performance();
$performance_metrics = $performance->get_performance_metrics();
$core_web_vitals = $performance->get_core_web_vitals();

// Calculate security score
$security_score = 100;
if ($security_status['debug_mode']) $security_score -= 15;
if (!$security_status['ssl_enabled']) $security_score -= 25;
if (!$security_status['file_edit_disabled']) $security_score -= 10;
if ($security_status['admin_username'] === 'admin') $security_score -= 20;
$security_score -= count($security_status['outdated_plugins']) * 5;
$security_score = max(0, $security_score);

// Get update counts
if (!function_exists('get_plugin_updates')) {
    require_once ABSPATH . 'wp-admin/includes/update.php';
}
$plugin_updates = get_plugin_updates();
$theme_updates = get_theme_updates();
$core_updates = get_core_updates();
$core_update_available = !empty($core_updates) && isset($core_updates[0]->response) && $core_updates[0]->response === 'upgrade';

$last_security_scan = get_option('wpma_last_security_scan', '');
$last_health_check = get_option('wpma_last_health_check', '');
?>

<div class="wrap wpma-dashboard">
    <div class="wpma-header">
        <div class="wpma-header-left">
            <h1>🚀 WPMA.io</h1>
            <span class="wpma-site-badge"><?php echo esc_html($site_name); ?></span>
        </div>
        <div class="wpma-header-right">
            <span class="wpma-connected-badge">
                <span class="wpma-dot wpma-dot-green"></span>
                Verbunden mit WPMA.io
            </span>
            <a href="https://app.wpma.io/sites/<?php echo esc_attr($site_id); ?>" target="_blank" class="button button-primary">
                Dashboard öffnen ↗
            </a>
        </div>
    </div>

    <p class="wpma-intro">
        <strong>Was macht WPMA.io?</strong> Wir überwachen automatisch deine WordPress-Site: Security-Scans, Performance-Checks, Uptime-Monitoring und mehr – alles an einem Ort.
    </p>

    <!-- Feature Cards Grid -->
    <div class="wpma-features-grid">
        
        <!-- Uptime Monitoring -->
        <div class="wpma-feature-card">
            <div class="wpma-card-header">
                <div class="wpma-card-icon wpma-icon-green">📡</div>
                <h3>Uptime Monitoring</h3>
                <span class="wpma-status-badge wpma-status-active">Aktiv</span>
            </div>
            <div class="wpma-card-body">
                <div class="wpma-stat-row">
                    <span class="wpma-stat-label">Status</span>
                    <span class="wpma-stat-value wpma-text-green">
                        <span class="wpma-dot wpma-dot-green"></span> Website Online
                    </span>
                </div>
                <div class="wpma-stat-row">
                    <span class="wpma-stat-label">Check-Intervall</span>
                    <span class="wpma-stat-value">Alle 5 Minuten</span>
                </div>
                <div class="wpma-stat-row">
                    <span class="wpma-stat-label">Benachrichtigung</span>
                    <span class="wpma-stat-value">E-Mail bei Downtime</span>
                </div>
            </div>
            <div class="wpma-card-footer">
                <span class="wpma-feature-info">24/7 Überwachung aktiv</span>
            </div>
        </div>

        <!-- Security -->
        <div class="wpma-feature-card">
            <div class="wpma-card-header">
                <div class="wpma-card-icon wpma-icon-blue">🛡️</div>
                <h3>Security</h3>
                <span class="wpma-status-badge <?php echo $security_score >= 80 ? 'wpma-status-active' : ($security_score >= 50 ? 'wpma-status-warning' : 'wpma-status-danger'); ?>">
                    Score: <?php echo $security_score; ?>
                </span>
            </div>
            <div class="wpma-card-body">
                <div class="wpma-stat-row">
                    <span class="wpma-stat-label">Probleme gefunden</span>
                    <span class="wpma-stat-value <?php echo count($security_status['outdated_plugins']) > 0 ? 'wpma-text-orange' : 'wpma-text-green'; ?>">
                        <?php 
                        $issues = 0;
                        if ($security_status['debug_mode']) $issues++;
                        if (!$security_status['ssl_enabled']) $issues++;
                        if (!$security_status['file_edit_disabled']) $issues++;
                        if ($security_status['admin_username'] === 'admin') $issues++;
                        $issues += count($security_status['outdated_plugins']);
                        echo $issues;
                        ?>
                    </span>
                </div>
                <div class="wpma-stat-row">
                    <span class="wpma-stat-label">Nächster Scan</span>
                    <span class="wpma-stat-value">Täglich, 02:00 Uhr</span>
                </div>
                <div class="wpma-stat-row">
                    <span class="wpma-stat-label">Letzter Scan</span>
                    <span class="wpma-stat-value"><?php echo $last_security_scan ? date_i18n('d.m.Y H:i', strtotime($last_security_scan)) : 'Noch nie'; ?></span>
                </div>
            </div>
            <div class="wpma-card-footer">
                <button type="button" class="button wpma-action-btn" id="wpma-run-security">
                    Scan starten
                </button>
            </div>
        </div>

        <!-- Performance -->
        <div class="wpma-feature-card">
            <div class="wpma-card-header">
                <div class="wpma-card-icon wpma-icon-purple">⚡</div>
                <h3>Performance</h3>
                <span class="wpma-status-badge wpma-status-active">Aktiv</span>
            </div>
            <div class="wpma-card-body">
                <div class="wpma-stat-row">
                    <span class="wpma-stat-label">Ladezeit</span>
                    <span class="wpma-stat-value <?php echo $performance_metrics['page_load_time'] < 1000 ? 'wpma-text-green' : ($performance_metrics['page_load_time'] < 3000 ? 'wpma-text-orange' : 'wpma-text-red'); ?>">
                        <?php echo number_format($performance_metrics['page_load_time']); ?> ms
                    </span>
                </div>
                <div class="wpma-stat-row">
                    <span class="wpma-stat-label">DB Queries</span>
                    <span class="wpma-stat-value"><?php echo $performance_metrics['database_queries']; ?></span>
                </div>
                <div class="wpma-stat-row">
                    <span class="wpma-stat-label">Core Web Vitals</span>
                    <span class="wpma-stat-value">
                        LCP: <?php echo $core_web_vitals['lcp'] > 0 ? round($core_web_vitals['lcp']) . 'ms' : '-'; ?>
                    </span>
                </div>
            </div>
            <div class="wpma-card-footer">
                <button type="button" class="button wpma-action-btn" id="wpma-run-performance">
                    Test starten
                </button>
            </div>
        </div>

        <!-- Automated Updates -->
        <div class="wpma-feature-card">
            <div class="wpma-card-header">
                <div class="wpma-card-icon wpma-icon-orange">🔄</div>
                <h3>Updates</h3>
                <?php 
                $total_updates = count($plugin_updates) + count($theme_updates) + ($core_update_available ? 1 : 0);
                ?>
                <span class="wpma-status-badge <?php echo $total_updates > 0 ? 'wpma-status-warning' : 'wpma-status-active'; ?>">
                    <?php echo $total_updates; ?> verfügbar
                </span>
            </div>
            <div class="wpma-card-body">
                <div class="wpma-updates-grid">
                    <div class="wpma-update-item">
                        <span class="wpma-update-count <?php echo $core_update_available ? 'wpma-bg-orange' : 'wpma-bg-green'; ?>">
                            <?php echo $core_update_available ? '1' : '✓'; ?>
                        </span>
                        <span class="wpma-update-label">Core</span>
                    </div>
                    <div class="wpma-update-item">
                        <span class="wpma-update-count <?php echo count($plugin_updates) > 0 ? 'wpma-bg-orange' : 'wpma-bg-green'; ?>">
                            <?php echo count($plugin_updates) > 0 ? count($plugin_updates) : '✓'; ?>
                        </span>
                        <span class="wpma-update-label">Plugins</span>
                    </div>
                    <div class="wpma-update-item">
                        <span class="wpma-update-count <?php echo count($theme_updates) > 0 ? 'wpma-bg-orange' : 'wpma-bg-green'; ?>">
                            <?php echo count($theme_updates) > 0 ? count($theme_updates) : '✓'; ?>
                        </span>
                        <span class="wpma-update-label">Themes</span>
                    </div>
                </div>
            </div>
            <div class="wpma-card-footer">
                <?php if ($total_updates > 0): ?>
                    <a href="<?php echo admin_url('update-core.php'); ?>" class="button">
                        Updates anzeigen
                    </a>
                <?php else: ?>
                    <span class="wpma-feature-info">✓ Alles aktuell</span>
                <?php endif; ?>
            </div>
        </div>

        <!-- Backups -->
        <div class="wpma-feature-card">
            <div class="wpma-card-header">
                <div class="wpma-card-icon wpma-icon-teal">💾</div>
                <h3>Backups</h3>
                <span class="wpma-status-badge wpma-status-active">Überwacht</span>
            </div>
            <div class="wpma-card-body">
                <div class="wpma-stat-row">
                    <span class="wpma-stat-label">Backup-Plugin</span>
                    <span class="wpma-stat-value">
                        <?php
                        $backup_plugins = array(
                            'updraftplus/updraftplus.php' => 'UpdraftPlus',
                            'backwpup/backwpup.php' => 'BackWPup',
                            'duplicator/duplicator.php' => 'Duplicator',
                            'all-in-one-wp-migration/all-in-one-wp-migration.php' => 'All-in-One Migration'
                        );
                        $found_backup = 'Keins erkannt';
                        foreach ($backup_plugins as $plugin => $name) {
                            if (is_plugin_active($plugin)) {
                                $found_backup = $name;
                                break;
                            }
                        }
                        echo esc_html($found_backup);
                        ?>
                    </span>
                </div>
                <div class="wpma-stat-row">
                    <span class="wpma-stat-label">DB Größe</span>
                    <span class="wpma-stat-value"><?php echo round($performance_metrics['database_size'] / 1024 / 1024, 1); ?> MB</span>
                </div>
            </div>
            <div class="wpma-card-footer">
                <span class="wpma-feature-info">Status wird überwacht</span>
            </div>
        </div>

        <!-- System Health -->
        <div class="wpma-feature-card">
            <div class="wpma-card-header">
                <div class="wpma-card-icon wpma-icon-gray">ℹ️</div>
                <h3>System</h3>
            </div>
            <div class="wpma-card-body">
                <div class="wpma-stat-row">
                    <span class="wpma-stat-label">WordPress</span>
                    <span class="wpma-stat-value"><?php echo get_bloginfo('version'); ?></span>
                </div>
                <div class="wpma-stat-row">
                    <span class="wpma-stat-label">PHP</span>
                    <span class="wpma-stat-value"><?php echo phpversion(); ?></span>
                </div>
                <div class="wpma-stat-row">
                    <span class="wpma-stat-label">Aktive Plugins</span>
                    <span class="wpma-stat-value"><?php echo count(get_option('active_plugins', array())); ?></span>
                </div>
                <div class="wpma-stat-row">
                    <span class="wpma-stat-label">Theme</span>
                    <span class="wpma-stat-value"><?php echo wp_get_theme()->get('Name'); ?></span>
                </div>
            </div>
            <div class="wpma-card-footer">
                <button type="button" class="button wpma-action-btn" id="wpma-run-health">
                    Health Check
                </button>
            </div>
        </div>

    </div>

    <!-- Action Results -->
    <div id="wpma-action-result"></div>

</div>

<style>
.wpma-dashboard {
    max-width: 1400px;
    margin-top: 20px;
}

.wpma-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding: 20px;
    background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
    border-radius: 12px;
    color: #fff;
}

.wpma-header h1 {
    margin: 0;
    color: #fff;
    font-size: 28px;
}

.wpma-site-badge {
    background: rgba(255,255,255,0.2);
    padding: 4px 12px;
    border-radius: 100px;
    font-size: 13px;
    margin-left: 12px;
}

.wpma-header-right {
    display: flex;
    align-items: center;
    gap: 16px;
}

.wpma-connected-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255,255,255,0.15);
    padding: 8px 16px;
    border-radius: 100px;
    font-size: 13px;
}

.wpma-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
}

.wpma-dot-green {
    background: #4ade80;
    box-shadow: 0 0 8px rgba(74, 222, 128, 0.6);
}

.wpma-intro {
    background: #f0f6fc;
    border-left: 4px solid #2d5a87;
    padding: 16px 20px;
    margin-bottom: 24px;
    border-radius: 0 8px 8px 0;
    font-size: 15px;
}

.wpma-features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 20px;
}

.wpma-feature-card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
    transition: box-shadow 0.2s, transform 0.2s;
}

.wpma-feature-card:hover {
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    transform: translateY(-2px);
}

.wpma-card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid #f0f0f0;
    background: #fafafa;
}

.wpma-card-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
}

.wpma-icon-green { background: rgba(34, 197, 94, 0.15); }
.wpma-icon-blue { background: rgba(59, 130, 246, 0.15); }
.wpma-icon-purple { background: rgba(147, 51, 234, 0.15); }
.wpma-icon-orange { background: rgba(249, 115, 22, 0.15); }
.wpma-icon-teal { background: rgba(20, 184, 166, 0.15); }
.wpma-icon-gray { background: rgba(107, 114, 128, 0.15); }

.wpma-card-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    flex-grow: 1;
}

.wpma-status-badge {
    padding: 4px 10px;
    border-radius: 100px;
    font-size: 12px;
    font-weight: 600;
}

.wpma-status-active {
    background: rgba(34, 197, 94, 0.15);
    color: #16a34a;
}

.wpma-status-warning {
    background: rgba(245, 158, 11, 0.15);
    color: #d97706;
}

.wpma-status-danger {
    background: rgba(239, 68, 68, 0.15);
    color: #dc2626;
}

.wpma-card-body {
    padding: 16px 20px;
}

.wpma-stat-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #f5f5f5;
}

.wpma-stat-row:last-child {
    border-bottom: none;
}

.wpma-stat-label {
    color: #6b7280;
    font-size: 13px;
}

.wpma-stat-value {
    font-weight: 600;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 6px;
}

.wpma-text-green { color: #16a34a; }
.wpma-text-orange { color: #d97706; }
.wpma-text-red { color: #dc2626; }

.wpma-card-footer {
    padding: 12px 20px;
    background: #fafafa;
    border-top: 1px solid #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.wpma-feature-info {
    font-size: 12px;
    color: #6b7280;
}

.wpma-updates-grid {
    display: flex;
    gap: 16px;
    justify-content: center;
    padding: 12px 0;
}

.wpma-update-item {
    text-align: center;
}

.wpma-update-count {
    display: block;
    width: 48px;
    height: 48px;
    line-height: 48px;
    border-radius: 12px;
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 6px;
}

.wpma-bg-green {
    background: rgba(34, 197, 94, 0.15);
    color: #16a34a;
}

.wpma-bg-orange {
    background: rgba(245, 158, 11, 0.15);
    color: #d97706;
}

.wpma-update-label {
    font-size: 12px;
    color: #6b7280;
}

.wpma-action-btn {
    min-width: 100px;
}

#wpma-action-result {
    margin-top: 20px;
}

@media (max-width: 768px) {
    .wpma-header {
        flex-direction: column;
        gap: 16px;
        text-align: center;
    }
    
    .wpma-features-grid {
        grid-template-columns: 1fr;
    }
}
</style>

<script>
jQuery(document).ready(function($) {
    function doAction(action, button, label) {
        var $btn = $(button);
        var originalText = $btn.text();
        $btn.prop('disabled', true).text('Läuft...');
        
        $.ajax({
            url: wpmaAdmin.ajaxurl,
            type: 'POST',
            data: {
                action: action,
                nonce: wpmaAdmin.nonce
            },
            success: function(response) {
                if (response.success) {
                    $('#wpma-action-result').html('<div class="notice notice-success"><p>✓ ' + label + ' erfolgreich!</p></div>');
                    setTimeout(function() { location.reload(); }, 1500);
                } else {
                    $('#wpma-action-result').html('<div class="notice notice-error"><p>✗ Fehler: ' + (response.data || 'Unbekannt') + '</p></div>');
                }
            },
            error: function() {
                $('#wpma-action-result').html('<div class="notice notice-error"><p>✗ Netzwerkfehler</p></div>');
            },
            complete: function() {
                $btn.prop('disabled', false).text(originalText);
            }
        });
    }
    
    $('#wpma-run-security').click(function() { doAction('wpma_run_security_scan', this, 'Security Scan'); });
    $('#wpma-run-performance').click(function() { doAction('wpma_update_performance', this, 'Performance Test'); });
    $('#wpma-run-health').click(function() { doAction('wpma_update_health', this, 'Health Check'); });
});
</script>
