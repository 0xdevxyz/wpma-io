<?php
if (!defined('ABSPATH')) {
    exit;
}
?>

<div class="wrap wpma-setup-wizard">
    <h1>🚀 WPMA Agent Setup</h1>
    
    <div class="wpma-setup-container">
        <div class="wpma-setup-card">
            <div class="wpma-setup-header">
                <h2>Willkommen bei WPMA Agent!</h2>
                <p>Verbinden Sie Ihre WordPress-Site mit WPMA.io in wenigen Sekunden.</p>
            </div>
            
            <div class="wpma-setup-body">
                <div id="wpma-setup-step-1" class="wpma-setup-step active">
                    <h3>Schritt 1: Setup-Token eingeben</h3>
                    <p>Kopieren Sie den Setup-Token aus Ihrem WPMA.io Dashboard und fügen Sie ihn unten ein:</p>
                    
                    <div class="wpma-form-group">
                        <label for="wpma_setup_token">Setup-Token:</label>
                        <input 
                            type="text" 
                            id="wpma_setup_token" 
                            class="wpma-input large-text" 
                            placeholder="Token hier einfügen..."
                            autocomplete="off"
                        />
                        <p class="description">
                            Den Token finden Sie im WPMA.io Dashboard nach dem Erstellen Ihrer Site.
                        </p>
                    </div>
                    
                    <div id="wpma-setup-error" class="notice notice-error" style="display: none;">
                        <p></p>
                    </div>
                    
                    <div class="wpma-setup-actions">
                        <button type="button" id="wpma-setup-connect" class="button button-primary button-hero">
                            <span class="dashicons dashicons-admin-plugins" style="margin-top: 8px;"></span>
                            Jetzt verbinden
                        </button>
                    </div>
                </div>
                
                <div id="wpma-setup-step-2" class="wpma-setup-step" style="display: none;">
                    <div class="wpma-setup-success">
                        <span class="dashicons dashicons-yes-alt" style="color: #46b450; font-size: 64px;"></span>
                        <h3>✓ Erfolgreich verbunden!</h3>
                        <p>Ihre WordPress-Site ist jetzt mit WPMA.io verbunden.</p>
                        <p><strong>Site:</strong> <span id="wpma-connected-site"></span></p>
                    </div>
                    
                    <div class="wpma-setup-actions">
                        <a href="<?php echo admin_url('admin.php?page=wpma-agent'); ?>" class="button button-primary button-hero">
                            Zum Dashboard
                        </a>
                    </div>
                </div>
            </div>
            
            <div class="wpma-setup-footer">
                <p>
                    <strong>Hilfe benötigt?</strong> 
                    Besuchen Sie <a href="https://wpma.io/docs" target="_blank">wpma.io/docs</a> 
                    oder kontaktieren Sie den Support.
                </p>
            </div>
        </div>
    </div>
</div>

<style>
.wpma-setup-wizard {
    margin-top: 40px;
}

.wpma-setup-container {
    max-width: 800px;
    margin: 40px auto;
}

.wpma-setup-card {
    background: #fff;
    border: 1px solid #ccd0d4;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.wpma-setup-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    padding: 30px;
    border-radius: 8px 8px 0 0;
    text-align: center;
}

.wpma-setup-header h2 {
    color: #fff;
    margin: 0 0 10px 0;
    font-size: 28px;
}

.wpma-setup-header p {
    color: rgba(255,255,255,0.9);
    margin: 0;
    font-size: 16px;
}

.wpma-setup-body {
    padding: 30px;
}

.wpma-setup-step h3 {
    margin-top: 0;
    font-size: 20px;
    color: #23282d;
}

.wpma-form-group {
    margin: 25px 0;
}

.wpma-form-group label {
    display: block;
    font-weight: 600;
    margin-bottom: 8px;
    color: #23282d;
}

.wpma-input {
    padding: 12px;
    font-size: 16px;
    border: 2px solid #ddd;
    border-radius: 4px;
    transition: border-color 0.2s;
    font-family: monospace;
}

.wpma-input:focus {
    border-color: #667eea;
    outline: none;
    box-shadow: 0 0 0 1px #667eea;
}

.wpma-setup-actions {
    margin-top: 30px;
    text-align: center;
}

.button-hero {
    padding: 12px 36px !important;
    height: auto !important;
    font-size: 16px !important;
}

.wpma-setup-success {
    text-align: center;
    padding: 20px;
}

.wpma-setup-success h3 {
    color: #46b450;
    font-size: 24px;
}

.wpma-setup-footer {
    background: #f9f9f9;
    padding: 20px 30px;
    border-top: 1px solid #e5e5e5;
    border-radius: 0 0 8px 8px;
    text-align: center;
}

.wpma-setup-footer p {
    margin: 0;
    color: #666;
}

#wpma-setup-error p {
    margin: 0.5em 0;
}

.wpma-loading {
    opacity: 0.6;
    pointer-events: none;
}
</style>

<script>
jQuery(document).ready(function($) {
    $('#wpma-setup-connect').on('click', function() {
        var $button = $(this);
        var $error = $('#wpma-setup-error');
        var token = $('#wpma_setup_token').val().trim();
        
        // Validate
        if (!token) {
            $error.find('p').text('Bitte geben Sie einen Setup-Token ein.');
            $error.show();
            return;
        }
        
        // Hide error
        $error.hide();
        
        // Loading state
        $button.addClass('wpma-loading');
        $button.html('<span class="dashicons dashicons-update-alt" style="margin-top: 8px; animation: rotation 1s infinite linear;"></span> Verbindung wird hergestellt...');
        
        // Exchange token
        $.ajax({
            url: '<?php echo admin_url('admin-ajax.php'); ?>',
            method: 'POST',
            dataType: 'json',
            data: {
                action: 'wpma_exchange_token',
                token: token,
                nonce: '<?php echo wp_create_nonce('wpma_setup_nonce'); ?>'
            },
            success: function(response) {
                console.log('Token exchange response:', response);
                
                if (response.success) {
                    // Show success step
                    $('#wpma-connected-site').text(response.data.siteName || 'Ihre Site');
                    $('#wpma-setup-step-1').hide();
                    $('#wpma-setup-step-2').fadeIn();
                } else {
                    var errorMsg = 'Verbindung fehlgeschlagen. Bitte überprüfen Sie Ihren Token.';
                    if (response.data && response.data.message) {
                        errorMsg = response.data.message;
                    }
                    $error.find('p').html('<strong>Fehler:</strong> ' + errorMsg);
                    $error.show();
                    $button.removeClass('wpma-loading');
                    $button.html('<span class="dashicons dashicons-admin-plugins" style="margin-top: 8px;"></span> Jetzt verbinden');
                }
            },
            error: function(xhr, status, error) {
                console.error('AJAX error:', status, error);
                console.error('Response:', xhr.responseText);
                
                var errorMsg = 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
                if (xhr.status === 0) {
                    errorMsg = 'Netzwerkfehler: Kann API nicht erreichen. Bitte überprüfen Sie Ihre Internetverbindung.';
                } else if (xhr.status === 404) {
                    errorMsg = 'API-Endpunkt nicht gefunden. Bitte kontaktieren Sie den Support.';
                } else if (xhr.status === 500) {
                    errorMsg = 'Server-Fehler. Bitte versuchen Sie es später erneut.';
                }
                
                $error.find('p').html('<strong>Fehler:</strong> ' + errorMsg + ' (Status: ' + xhr.status + ')');
                $error.show();
                $button.removeClass('wpma-loading');
                $button.html('<span class="dashicons dashicons-admin-plugins" style="margin-top: 8px;"></span> Jetzt verbinden');
            }
        });
    });
    
    // Allow Enter key to submit
    $('#wpma_setup_token').on('keypress', function(e) {
        if (e.which === 13) {
            $('#wpma-setup-connect').click();
        }
    });
});
</script>

<style>
@keyframes rotation {
    from { transform: rotate(0deg); }
    to { transform: rotate(359deg); }
}
</style>

