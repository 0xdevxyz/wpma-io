<?php
if (!defined('ABSPATH')) {
    exit;
}

$api_key = get_option('wpma_api_key', '');
$site_id = get_option('wpma_site_id', '');
$site_name = get_option('wpma_site_name', get_bloginfo('name'));
$enable_monitoring = get_option('wpma_enable_monitoring', true);
$enable_backups = get_option('wpma_enable_backups', true);
$enable_security_scans = get_option('wpma_enable_security_scans', true);

$api_client = new WPMA_API();
$connection_status = $api_client->test_connection($api_key);
?>

<div class="wrap">
    <h1>WPMA Agent Einstellungen</h1>
    
    <?php if (isset($_GET['settings-updated'])): ?>
        <div class="notice notice-success is-dismissible">
            <p>Einstellungen erfolgreich gespeichert.</p>
        </div>
    <?php endif; ?>
    
    <form method="post" action="options.php">
        <?php settings_fields('wpma_settings'); ?>
        
        <table class="form-table">
            <tr>
                <th scope="row">
                    <label for="wpma_api_key">API Key</label>
                </th>
                <td>
                    <input type="text" id="wpma_api_key" name="wpma_api_key" 
                           value="<?php echo esc_attr($api_key); ?>" class="regular-text" />
                    <p class="description">
                        Ihr API Key von <a href="https://app.wpma.io" target="_blank">app.wpma.io</a>
                    </p>
                </td>
            </tr>
            
            <tr>
                <th scope="row">
                    <label for="wpma_site_name">Site Name</label>
                </th>
                <td>
                    <input type="text" id="wpma_site_name" name="wpma_site_name" 
                           value="<?php echo esc_attr($site_name); ?>" class="regular-text" />
                    <p class="description">
                        Name Ihrer WordPress-Site für die Anzeige im Dashboard
                    </p>
                </td>
            </tr>
            
            <tr>
                <th scope="row">Verbindungsstatus</th>
                <td>
                    <?php if ($api_key && $connection_status['success']): ?>
                        <span class="dashicons dashicons-yes-alt" style="color: green;"></span>
                        <span style="color: green;">Verbunden mit WPMA.io</span>
                    <?php elseif ($api_key): ?>
                        <span class="dashicons dashicons-no-alt" style="color: red;"></span>
                        <span style="color: red;">Verbindung fehlgeschlagen: <?php echo esc_html($connection_status['error'] ?? 'Unbekannter Fehler'); ?></span>
                    <?php else: ?>
                        <span class="dashicons dashicons-warning" style="color: orange;"></span>
                        <span style="color: orange;">API Key nicht konfiguriert</span>
                    <?php endif; ?>
                </td>
            </tr>
            
            <tr>
                <th scope="row">Monitoring</th>
                <td>
                    <label>
                        <input type="checkbox" name="wpma_enable_monitoring" value="1" 
                               <?php checked($enable_monitoring); ?> />
                        Automatisches Monitoring aktivieren
                    </label>
                    <p class="description">
                        Führt stündliche Health Checks durch
                    </p>
                </td>
            </tr>
            
            <tr>
                <th scope="row">Sicherheitsscans</th>
                <td>
                    <label>
                        <input type="checkbox" name="wpma_enable_security_scans" value="1" 
                               <?php checked($enable_security_scans); ?> />
                        Automatische Sicherheitsscans aktivieren
                    </label>
                    <p class="description">
                        Führt tägliche Sicherheitsscans durch
                    </p>
                </td>
            </tr>
            
            <tr>
                <th scope="row">Backups</th>
                <td>
                    <label>
                        <input type="checkbox" name="wpma_enable_backups" value="1" 
                               <?php checked($enable_backups); ?> />
                        Backup-Überwachung aktivieren
                    </label>
                    <p class="description">
                        Überwacht Backup-Status und -Integrität
                    </p>
                </td>
            </tr>
        </table>
        
        <?php submit_button(); ?>
    </form>
    
    <?php if ($api_key): ?>
        <hr>
        <h2>Manuelle Aktionen</h2>
        <p>
            <button type="button" class="button button-secondary" id="test-connection">
                Verbindung testen
            </button>
            <button type="button" class="button button-secondary" id="run-health-check">
                Health Check ausführen
            </button>
            <button type="button" class="button button-secondary" id="run-security-scan">
                Sicherheitsscan ausführen
            </button>
        </p>
        
        <div id="action-results"></div>
    <?php endif; ?>
</div>

<script>
jQuery(document).ready(function($) {
    $('#test-connection').click(function() {
        var button = $(this);
        button.prop('disabled', true).text('Teste...');
        
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'wpma_test_connection',
                nonce: '<?php echo wp_create_nonce('wpma_nonce'); ?>'
            },
            success: function(response) {
                if (response.success) {
                    $('#action-results').html('<div class="notice notice-success"><p>' + response.data + '</p></div>');
                } else {
                    $('#action-results').html('<div class="notice notice-error"><p>' + response.data + '</p></div>');
                }
            },
            error: function() {
                $('#action-results').html('<div class="notice notice-error"><p>Verbindungstest fehlgeschlagen</p></div>');
            },
            complete: function() {
                button.prop('disabled', false).text('Verbindung testen');
            }
        });
    });
    
    $('#run-health-check').click(function() {
        var button = $(this);
        button.prop('disabled', true).text('Führe aus...');
        
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'wpma_update_health',
                nonce: '<?php echo wp_create_nonce('wpma_nonce'); ?>'
            },
            success: function(response) {
                if (response.success) {
                    $('#action-results').html('<div class="notice notice-success"><p>' + response.data + '</p></div>');
                } else {
                    $('#action-results').html('<div class="notice notice-error"><p>' + response.data + '</p></div>');
                }
            },
            error: function() {
                $('#action-results').html('<div class="notice notice-error"><p>Health Check fehlgeschlagen</p></div>');
            },
            complete: function() {
                button.prop('disabled', false).text('Health Check ausführen');
            }
        });
    });
    
    $('#run-security-scan').click(function() {
        var button = $(this);
        button.prop('disabled', true).text('Führe aus...');
        
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'wpma_run_security_scan',
                nonce: '<?php echo wp_create_nonce('wpma_nonce'); ?>'
            },
            success: function(response) {
                if (response.success) {
                    $('#action-results').html('<div class="notice notice-success"><p>' + response.data + '</p></div>');
                } else {
                    $('#action-results').html('<div class="notice notice-error"><p>' + response.data + '</p></div>');
                }
            },
            error: function() {
                $('#action-results').html('<div class="notice notice-error"><p>Sicherheitsscan fehlgeschlagen</p></div>');
            },
            complete: function() {
                button.prop('disabled', false).text('Sicherheitsscan ausführen');
            }
        });
    });
});
</script> 