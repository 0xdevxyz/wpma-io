<?php
if (!defined('ABSPATH')) {
    exit;
}
?>

<div class="wrap wpma-onboarding">
    <div class="wpma-onboarding-container">
        
        <!-- Hero Section -->
        <div class="wpma-onboarding-hero">
            <div class="wpma-logo-big">🚀</div>
            <h1>Willkommen bei WPMA.io</h1>
            <p class="wpma-hero-subtitle">
                Verbinde deine WordPress-Site in 30 Sekunden und aktiviere automatisches Monitoring, Security-Scans und Performance-Tracking.
            </p>
        </div>

        <!-- Features Preview -->
        <div class="wpma-features-preview">
            <h2>Das bekommst du:</h2>
            <div class="wpma-preview-grid">
                <div class="wpma-preview-item">
                    <span class="wpma-preview-icon">📡</span>
                    <div>
                        <strong>24/7 Uptime Monitoring</strong>
                        <p>Wir prüfen alle 5 Minuten, ob deine Site online ist. Bei Ausfall: sofortige E-Mail.</p>
                    </div>
                </div>
                <div class="wpma-preview-item">
                    <span class="wpma-preview-icon">🛡️</span>
                    <div>
                        <strong>Security Scans</strong>
                        <p>Tägliche Sicherheitsüberprüfungen: SSL, veraltete Plugins, Debug-Mode, und mehr.</p>
                    </div>
                </div>
                <div class="wpma-preview-item">
                    <span class="wpma-preview-icon">⚡</span>
                    <div>
                        <strong>Performance Tracking</strong>
                        <p>Core Web Vitals, Ladezeiten und Datenbank-Performance im Blick behalten.</p>
                    </div>
                </div>
                <div class="wpma-preview-item">
                    <span class="wpma-preview-icon">🔄</span>
                    <div>
                        <strong>Update-Überwachung</strong>
                        <p>Werde benachrichtigt, wenn WordPress, Plugins oder Themes Updates brauchen.</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Connection Form -->
        <div class="wpma-connect-box">
            <h2>🔗 Mit WPMA.io verbinden</h2>
            <p>Gib deinen Setup-Token ein, um diese Site zu verbinden:</p>
            
            <div class="wpma-form-group">
                <label for="wpma_setup_token">Setup-Token</label>
                <input 
                    type="text" 
                    id="wpma_setup_token" 
                    class="wpma-input" 
                    placeholder="Füge deinen Token hier ein..."
                    autocomplete="off"
                />
                <p class="wpma-help-text">
                    Den Token findest du in deinem 
                    <a href="https://app.wpma.io" target="_blank">WPMA.io Dashboard</a> 
                    nach dem Erstellen einer neuen Site.
                </p>
            </div>
            
            <div id="wpma-connect-error" class="wpma-alert wpma-alert-error" style="display: none;">
                <span id="wpma-error-message"></span>
            </div>
            
            <div id="wpma-connect-success" class="wpma-alert wpma-alert-success" style="display: none;">
                <strong>✓ Erfolgreich verbunden!</strong>
                <p>Deine Site "<span id="wpma-connected-name"></span>" ist jetzt mit WPMA.io verbunden.</p>
            </div>
            
            <button type="button" id="wpma-connect-btn" class="wpma-btn-primary">
                <span class="wpma-btn-text">Jetzt verbinden</span>
                <span class="wpma-btn-loading" style="display: none;">Verbindung wird hergestellt...</span>
            </button>
        </div>

        <!-- Alternative: Manual Setup -->
        <div class="wpma-alternative">
            <p>Noch kein Account? <a href="https://app.wpma.io/auth/register" target="_blank">Kostenlos registrieren →</a></p>
        </div>

    </div>
</div>

<style>
.wpma-onboarding {
    max-width: 800px;
    margin: 40px auto;
}

.wpma-onboarding-container {
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    overflow: hidden;
}

.wpma-onboarding-hero {
    background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
    color: #fff;
    padding: 48px 40px;
    text-align: center;
}

.wpma-logo-big {
    font-size: 64px;
    margin-bottom: 16px;
}

.wpma-onboarding-hero h1 {
    margin: 0 0 12px 0;
    font-size: 32px;
    color: #fff;
}

.wpma-hero-subtitle {
    font-size: 18px;
    opacity: 0.9;
    margin: 0;
    max-width: 500px;
    margin: 0 auto;
    line-height: 1.6;
}

.wpma-features-preview {
    padding: 32px 40px;
    background: #f8fafc;
    border-bottom: 1px solid #e5e7eb;
}

.wpma-features-preview h2 {
    margin: 0 0 20px 0;
    font-size: 18px;
    color: #374151;
}

.wpma-preview-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
}

.wpma-preview-item {
    display: flex;
    gap: 14px;
    padding: 16px;
    background: #fff;
    border-radius: 10px;
    border: 1px solid #e5e7eb;
}

.wpma-preview-icon {
    font-size: 28px;
    flex-shrink: 0;
}

.wpma-preview-item strong {
    display: block;
    font-size: 14px;
    color: #1f2937;
    margin-bottom: 4px;
}

.wpma-preview-item p {
    margin: 0;
    font-size: 13px;
    color: #6b7280;
    line-height: 1.5;
}

.wpma-connect-box {
    padding: 40px;
}

.wpma-connect-box h2 {
    margin: 0 0 8px 0;
    font-size: 22px;
}

.wpma-connect-box > p {
    color: #6b7280;
    margin: 0 0 24px 0;
}

.wpma-form-group {
    margin-bottom: 20px;
}

.wpma-form-group label {
    display: block;
    font-weight: 600;
    margin-bottom: 8px;
    color: #374151;
}

.wpma-input {
    width: 100%;
    padding: 14px 16px;
    font-size: 16px;
    border: 2px solid #e5e7eb;
    border-radius: 10px;
    transition: border-color 0.2s, box-shadow 0.2s;
    font-family: 'SF Mono', 'Monaco', monospace;
}

.wpma-input:focus {
    border-color: #2d5a87;
    outline: none;
    box-shadow: 0 0 0 4px rgba(45, 90, 135, 0.1);
}

.wpma-help-text {
    font-size: 13px;
    color: #6b7280;
    margin-top: 8px;
}

.wpma-help-text a {
    color: #2d5a87;
}

.wpma-alert {
    padding: 14px 18px;
    border-radius: 10px;
    margin-bottom: 20px;
}

.wpma-alert-error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
}

.wpma-alert-success {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #16a34a;
}

.wpma-alert-success p {
    margin: 6px 0 0 0;
    font-weight: normal;
}

.wpma-btn-primary {
    width: 100%;
    padding: 16px 24px;
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
}

.wpma-btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(45, 90, 135, 0.3);
}

.wpma-btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
}

.wpma-alternative {
    padding: 20px 40px;
    text-align: center;
    background: #f8fafc;
    border-top: 1px solid #e5e7eb;
}

.wpma-alternative p {
    margin: 0;
    color: #6b7280;
    font-size: 14px;
}

.wpma-alternative a {
    color: #2d5a87;
    font-weight: 600;
}

@media (max-width: 600px) {
    .wpma-onboarding {
        margin: 20px;
    }
    
    .wpma-preview-grid {
        grid-template-columns: 1fr;
    }
    
    .wpma-onboarding-hero,
    .wpma-connect-box,
    .wpma-features-preview {
        padding: 24px;
    }
}
</style>

<script>
jQuery(document).ready(function($) {
    var $btn = $('#wpma-connect-btn');
    var $input = $('#wpma_setup_token');
    var $error = $('#wpma-connect-error');
    var $success = $('#wpma-connect-success');
    
    $btn.on('click', function() {
        var token = $input.val().trim();
        
        if (!token) {
            $error.show().find('#wpma-error-message').text('Bitte gib einen Setup-Token ein.');
            return;
        }
        
        // Disable button
        $btn.prop('disabled', true);
        $btn.find('.wpma-btn-text').hide();
        $btn.find('.wpma-btn-loading').show();
        $error.hide();
        
        $.ajax({
            url: '<?php echo admin_url('admin-ajax.php'); ?>',
            method: 'POST',
            data: {
                action: 'wpma_exchange_token',
                token: token,
                nonce: '<?php echo wp_create_nonce('wpma_setup_nonce'); ?>'
            },
            success: function(response) {
                if (response.success) {
                    $success.show().find('#wpma-connected-name').text(response.data.siteName || 'Deine Site');
                    $btn.hide();
                    $input.prop('disabled', true);
                    
                    // Redirect to dashboard after 2 seconds
                    setTimeout(function() {
                        window.location.reload();
                    }, 2000);
                } else {
                    var msg = response.data && response.data.message ? response.data.message : 'Verbindung fehlgeschlagen. Bitte prüfe deinen Token.';
                    $error.show().find('#wpma-error-message').text(msg);
                    $btn.prop('disabled', false);
                    $btn.find('.wpma-btn-text').show();
                    $btn.find('.wpma-btn-loading').hide();
                }
            },
            error: function() {
                $error.show().find('#wpma-error-message').text('Netzwerkfehler. Bitte versuche es erneut.');
                $btn.prop('disabled', false);
                $btn.find('.wpma-btn-text').show();
                $btn.find('.wpma-btn-loading').hide();
            }
        });
    });
    
    // Allow Enter key
    $input.on('keypress', function(e) {
        if (e.which === 13) {
            $btn.click();
        }
    });
});
</script>

