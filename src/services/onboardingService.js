'use strict';

/**
 * Onboarding Service
 *
 * Sequenzieller Setup-Flow nach Plugin-Verbindung:
 *   1. malware_scan       — Security-Scan via Plugin-Endpoint
 *   2. backup             — Vollständiges Backup vor Änderungen
 *   3. health_and_update  — Health-Check + alle verfügbaren Updates einspielen
 *                          (Premium-Plugins ohne Lizenz werden gemeldet & übersprungen)
 *   4. functional_check   — HTTP-Prüfung ob Site noch erreichbar
 *                          Bei Fehler: Rollback auf Backup aus Schritt 2
 *
 * Nach Abschluss: Alle anderen Features werden freigeschaltet.
 * Benachrichtigungen pro Schritt via Email / Discord / Telegram.
 */

const axios = require('axios');
const { query } = require('../config/database');
const notificationService = require('./notificationService');

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

async function getSite(siteId) {
    const r = await query('SELECT * FROM sites WHERE id = $1 AND status = $2', [siteId, 'active']);
    return r.rows[0] || null;
}

async function setOnboardingStatus(siteId, status) {
    await query(
        'UPDATE sites SET onboarding_status = $1, updated_at = NOW() WHERE id = $2',
        [status, siteId]
    );
}

async function startStep(siteId, step) {
    // Upsert: Falls Schritt bereits existiert (Retry), aktualisieren
    const existing = await query(
        'SELECT id FROM site_onboarding_steps WHERE site_id = $1 AND step = $2',
        [siteId, step]
    );
    if (existing.rows.length > 0) {
        await query(
            `UPDATE site_onboarding_steps
             SET status = 'running', started_at = NOW(), error = NULL, result = NULL
             WHERE site_id = $1 AND step = $2`,
            [siteId, step]
        );
    } else {
        await query(
            `INSERT INTO site_onboarding_steps (site_id, step, status, started_at)
             VALUES ($1, $2, 'running', NOW())`,
            [siteId, step]
        );
    }
}

async function completeStep(siteId, step, result = {}) {
    await query(
        `UPDATE site_onboarding_steps
         SET status = 'completed', result = $1, completed_at = NOW()
         WHERE site_id = $2 AND step = $3`,
        [JSON.stringify(result), siteId, step]
    );
}

async function failStep(siteId, step, error, result = {}) {
    await query(
        `UPDATE site_onboarding_steps
         SET status = 'failed', error = $1, result = $2, completed_at = NOW()
         WHERE site_id = $3 AND step = $4`,
        [String(error), JSON.stringify(result), siteId, step]
    );
}

async function skipStep(siteId, step, reason = '') {
    await query(
        `UPDATE site_onboarding_steps
         SET status = 'skipped', result = $1, completed_at = NOW()
         WHERE site_id = $2 AND step = $3`,
        [JSON.stringify({ reason }), siteId, step]
    );
}

function pluginHeaders(apiKey) {
    return { 'X-WPMA-Key': apiKey, 'Content-Type': 'application/json' };
}

// Backup-Endpoint nutzt abweichenden Header-Namen
function backupHeaders(apiKey) {
    return { 'X-WPMA-API-Key': apiKey, 'Content-Type': 'application/json' };
}

async function notify(userId, siteId, domain, eventType, extra = {}) {
    try {
        await notificationService.notify(userId, eventType, { domain, siteId, ...extra });
    } catch (e) {
        console.error('[Onboarding] notify error:', e.message);
    }
}

// ─── Schritt 1: Malware / Security Scan ─────────────────────────────────────

async function stepMalwareScan(site) {
    const { id: siteId, site_url, api_key, user_id, domain } = site;
    await startStep(siteId, 'malware_scan');

    let scanResult = null;
    try {
        const url = site_url.replace(/\/$/, '');
        const resp = await axios.get(`${url}/wp-json/wpma/v1/security`, {
            headers: pluginHeaders(api_key),
            timeout: 30000,
        });
        scanResult = resp.data?.data || resp.data || {};

        const score = scanResult.security_score ?? scanResult.score ?? null;
        const hasCritical = (scanResult.issues || []).some(i => i.severity === 'critical');

        await completeStep(siteId, 'malware_scan', { score, hasCritical, raw: scanResult });

        if (hasCritical) {
            await notify(user_id, siteId, domain, 'onboarding_malware_found', {
                score,
                issues: scanResult.issues?.filter(i => i.severity === 'critical'),
                url: `${process.env.FRONTEND_URL || 'https://app.wpma.io'}/sites/${siteId}`,
            });
        } else {
            await notify(user_id, siteId, domain, 'onboarding_step_ok', {
                step: 'Sicherheits-Scan',
                detail: `Keine kritischen Bedrohungen gefunden. Score: ${score ?? 'n/a'}`,
            });
        }

        return { ok: true, hasCritical };
    } catch (err) {
        // Scan-Fehler ist kein harter Stopp – wir loggen und fahren fort
        await failStep(siteId, 'malware_scan', err.message);
        await notify(user_id, siteId, domain, 'onboarding_step_warning', {
            step: 'Sicherheits-Scan',
            detail: `Scan konnte nicht durchgeführt werden: ${err.message}`,
        });
        return { ok: false, skipped: true };
    }
}

// ─── Schritt 2: Backup ───────────────────────────────────────────────────────

async function stepBackup(site) {
    const { id: siteId, site_url, api_key, user_id, domain } = site;
    await startStep(siteId, 'backup');

    try {
        const url = site_url.replace(/\/$/, '');

        // Backup anstoßen — async-fähiges Plugin antwortet sofort mit backup_id + estimated_min.
        // Ältere Plugin-Versionen laufen synchron → max. 3 Minuten warten.
        const provider = process.env.IDRIVE_E2_ENDPOINT ? 'idrive_e2' : 'local';
        const credentials = provider === 'idrive_e2' ? {
            endpoint:   process.env.IDRIVE_E2_ENDPOINT,
            bucket:     process.env.IDRIVE_E2_BUCKET,
            access_key: process.env.IDRIVE_E2_ACCESS_KEY,
            secret_key: process.env.IDRIVE_E2_SECRET_KEY,
        } : {};

        let backupId = null;
        let estimatedMin = null;
        let sizeMb = null;

        try {
            const resp = await axios.post(
                `${url}/wp-json/wpma/v1/backup/create`,
                { backup_type: 'full', provider, upload_credentials: credentials },
                { headers: backupHeaders(api_key), timeout: 180000 }
            );
            const d = resp.data;
            backupId     = d?.backup_id || d?.data?.backup_id || d?.id || null;
            estimatedMin = d?.estimated_min || null;
            sizeMb       = d?.size_mb || null;

            // Wenn Plugin async antwortet (status: pending) → sofort als gestartet werten
            if (d?.status === 'pending' || backupId) {
                const msg = estimatedMin
                    ? `Backup läuft im Hintergrund (~${estimatedMin} Min., ${sizeMb} MB)`
                    : 'Backup gestartet';
                await completeStep(siteId, 'backup', {
                    backupId, status: 'running', estimatedMin, sizeMb, message: msg,
                });
                await notify(user_id, siteId, domain, 'backup_completed', {
                    backupType: 'full', estimatedMin, sizeMb,
                });
                return { ok: true, backupId };
            }
        } catch (timeoutErr) {
            const is504    = timeoutErr.response?.status === 504;
            const isTimeout = timeoutErr.code === 'ECONNABORTED' || timeoutErr.message.includes('timeout');
            if (is504 || isTimeout) {
                // 504 = Hosting hat die Verbindung nach ~60s gekappt, aber das Backup
                // läuft möglicherweise noch im Hintergrund auf dem WP-Server.
                const msg = is504
                    ? 'Backup läuft im Hintergrund (Hosting-Timeout nach 60s — normales Shared-Hosting-Limit)'
                    : 'Backup gestartet (Timeout)';
                await completeStep(siteId, 'backup', { status: 'running_in_background', backupId: null, message: msg });
                await notify(user_id, siteId, domain, 'backup_completed', { backupType: 'full' });
                return { ok: true, backupId: null };
            }
            throw timeoutErr;
        }

        await completeStep(siteId, 'backup', { backupId, status: 'completed' });
        await notify(user_id, siteId, domain, 'backup_completed', { backupType: 'full', sizeMb });
        return { ok: true, backupId };

    } catch (err) {
        await failStep(siteId, 'backup', err.message);
        await notify(user_id, siteId, domain, 'backup_failed', { error: err.message });
        return { ok: false, backupId: null };
    }
}

// ─── Schritt 3: Health Check + Updates ──────────────────────────────────────

async function stepHealthAndUpdate(site) {
    const { id: siteId, site_url, api_key, user_id, domain } = site;
    await startStep(siteId, 'health_and_update');

    try {
        const url = site_url.replace(/\/$/, '');

        // Health-Daten holen
        const healthResp = await axios.get(`${url}/wp-json/wpma/v1/health`, {
            headers: pluginHeaders(api_key),
            timeout: 20000,
        });
        const health = healthResp.data?.data || healthResp.data || {};

        // Plugin-Liste + Updates holen
        const pluginsResp = await axios.get(`${url}/wp-json/wpma/v1/plugins`, {
            headers: pluginHeaders(api_key),
            timeout: 20000,
        });
        // Endpoint gibt { plugins: [...] } zurück
        const pluginsRaw = pluginsResp.data?.data ?? pluginsResp.data ?? {};
        const plugins = Array.isArray(pluginsRaw) ? pluginsRaw : (pluginsRaw.plugins || []);

        // Updates mit verfügbarer neuer Version
        const updatablePlugins = plugins.filter(p => p.update_available || p.new_version);

        // Premium-Plugins identifizieren (kein Update-Link von wordpress.org → kommerziell)
        const premiumPlugins = updatablePlugins.filter(p =>
            p.update_url && !p.update_url.includes('wordpress.org')
        );
        const freePlugins = updatablePlugins.filter(p =>
            !p.update_url || p.update_url.includes('wordpress.org')
        );

        // Premium-Plugins: Lizenzanfragen speichern + User benachrichtigen
        for (const pp of premiumPlugins) {
            await query(
                `INSERT INTO pending_license_requests (site_id, plugin_slug, plugin_name)
                 VALUES ($1, $2, $3)
                 ON CONFLICT DO NOTHING`,
                [siteId, pp.slug || pp.plugin_file, pp.name]
            ).catch(() => {});
        }

        if (premiumPlugins.length > 0) {
            await notify(user_id, siteId, domain, 'onboarding_license_required', {
                plugins: premiumPlugins.map(p => p.name),
                url: `${process.env.FRONTEND_URL || 'https://app.wpma.io'}/sites/${siteId}`,
            });
        }

        // Freie Updates per agent-command ausführen
        let updatesApplied = 0;
        let updateErrors = [];

        if (freePlugins.length > 0 || health.total_updates > 0) {
            try {
                const updateResp = await axios.post(
                    `${url}/wp-json/wpma/v1/run-updates`,
                    {
                        plugins: freePlugins.map(p => p.plugin_file || p.slug),
                        update_core: !!(health.wordpress_updates || health.core_update_available),
                        update_themes: true,
                    },
                    { headers: pluginHeaders(api_key), timeout: 120000 }
                );
                updatesApplied = updateResp.data?.updated ?? updateResp.data?.data?.updated ?? freePlugins.length;
            } catch (e) {
                updateErrors.push(e.message);
            }
        }

        const result = {
            health_score: health.health_score,
            total_updates: health.total_updates || 0,
            free_updates_applied: updatesApplied,
            premium_pending: premiumPlugins.length,
            errors: updateErrors,
        };

        // Plugin-Count in DB persistieren
        const pluginCount = plugins.length;
        await query(
            'UPDATE sites SET plugin_count = $1, health_score = $2 WHERE id = $3',
            [pluginCount, health.health_score || null, siteId]
        ).catch(() => {});

        await completeStep(siteId, 'health_and_update', { ...result, plugin_count: pluginCount });
        await notify(user_id, siteId, domain, 'update_completed', {
            count: updatesApplied,
            premiumPending: premiumPlugins.length,
        });

        return { ok: true, ...result };
    } catch (err) {
        await failStep(siteId, 'health_and_update', err.message);
        await notify(user_id, siteId, domain, 'onboarding_step_warning', {
            step: 'Health & Updates',
            detail: err.message,
        });
        return { ok: false, error: err.message };
    }
}

// ─── Schritt 4: Functional Check ────────────────────────────────────────────

async function stepFunctionalCheck(site, backupId) {
    const { id: siteId, site_url, api_key, user_id, domain } = site;
    await startStep(siteId, 'functional_check');

    try {
        const url = site_url.replace(/\/$/, '');

        // HTTP GET auf die Site (max 3 Versuche mit 5s Pause)
        let lastStatus = null;
        let siteOk = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const resp = await axios.get(url, {
                    timeout: 20000,
                    validateStatus: null,
                    maxRedirects: 5,
                    headers: { 'User-Agent': 'WPMA-HealthCheck/1.0' },
                });
                lastStatus = resp.status;
                if (resp.status >= 200 && resp.status < 400) {
                    siteOk = true;
                    break;
                }
            } catch (_) {}
            if (attempt < 3) await sleep(5000);
        }

        if (siteOk) {
            await completeStep(siteId, 'functional_check', { httpStatus: lastStatus });
            await notify(user_id, siteId, domain, 'onboarding_step_ok', {
                step: 'Funktionsprüfung',
                detail: `Site antwortet korrekt (HTTP ${lastStatus}).`,
            });
            return { ok: true };
        }

        // Site antwortet nicht → Rollback
        await failStep(siteId, 'functional_check', `HTTP ${lastStatus || 'Timeout'}`, { httpStatus: lastStatus });
        await triggerRollback(site, backupId, lastStatus);
        return { ok: false, rolledBack: true };
    } catch (err) {
        await failStep(siteId, 'functional_check', err.message);
        await triggerRollback(site, backupId, null);
        return { ok: false, rolledBack: true };
    }
}

// ─── Rollback ────────────────────────────────────────────────────────────────

async function triggerRollback(site, backupId, httpStatus) {
    const { id: siteId, site_url, api_key, user_id, domain } = site;
    await startStep(siteId, 'rollback');

    const diagnosis = diagnose(httpStatus);

    try {
        if (backupId) {
            const url = site_url.replace(/\/$/, '');
            await axios.post(
                `${url}/wp-json/wpma/v1/backup/restore`,
                { backup_id: backupId },
                { headers: backupHeaders(api_key), timeout: 120000 }
            );
        }
        await completeStep(siteId, 'rollback', { backupId, diagnosis });
    } catch (e) {
        await failStep(siteId, 'rollback', e.message, { diagnosis });
    }

    await notify(user_id, siteId, domain, 'onboarding_rollback', {
        httpStatus,
        diagnosis,
        backupId,
        url: `${process.env.FRONTEND_URL || 'https://app.wpma.io'}/sites/${siteId}`,
    });
}

function diagnose(httpStatus) {
    if (!httpStatus)    return 'Site nicht erreichbar — mögliche Ursachen: PHP-Fehler nach Update, .htaccess beschädigt oder Hosting-Probleme.';
    if (httpStatus === 500) return 'HTTP 500 — PHP-Fehler, wahrscheinlich durch inkompatibles Plugin-Update ausgelöst.';
    if (httpStatus === 503) return 'HTTP 503 — Wartungsmodus aktiv oder Server überlastet.';
    if (httpStatus === 403) return 'HTTP 403 — Zugriffsrechte-Problem, möglicherweise .htaccess-Konflikt.';
    return `HTTP ${httpStatus} — Unerwarteter Status-Code nach Updates.`;
}

// ─── Hauptorchestrator ───────────────────────────────────────────────────────

async function runOnboardingFlow(siteId, userId) {
    const site = await getSite(siteId);
    if (!site) {
        console.error(`[Onboarding] Site ${siteId} nicht gefunden`);
        return;
    }

    // Bereits gestartet oder fertig → nicht doppelt starten
    if (['in_progress', 'completed'].includes(site.onboarding_status)) {
        console.log(`[Onboarding] Site ${siteId} bereits im Status ${site.onboarding_status}`);
        return;
    }

    console.log(`[Onboarding] ▶ Starte Flow für Site ${siteId} (${site.domain})`);
    await setOnboardingStatus(siteId, 'in_progress');

    try {
        // 1. Malware Scan
        await stepMalwareScan(site);

        // 2. Backup
        const backupResult = await stepBackup(site);

        // 3. Health + Updates
        await stepHealthAndUpdate(site);

        // 4. Functional Check (+ ggf. Rollback)
        const funcResult = await stepFunctionalCheck(site, backupResult.backupId);

        if (funcResult.ok) {
            await setOnboardingStatus(siteId, 'completed');
            await notify(site.user_id, siteId, site.domain, 'onboarding_completed', {
                url: `${process.env.FRONTEND_URL || 'https://app.wpma.io'}/sites/${siteId}`,
            });
            console.log(`[Onboarding] ✅ Flow abgeschlossen für Site ${siteId}`);
        } else {
            await setOnboardingStatus(siteId, 'failed');
            console.log(`[Onboarding] ❌ Functional Check fehlgeschlagen, Rollback für Site ${siteId}`);
        }
    } catch (err) {
        console.error(`[Onboarding] Unerwarteter Fehler für Site ${siteId}:`, err.message);
        await setOnboardingStatus(siteId, 'failed');
    }
}

// ─── Status-Abfrage ──────────────────────────────────────────────────────────

async function getOnboardingStatus(siteId) {
    const site = await query(
        'SELECT onboarding_status FROM sites WHERE id = $1',
        [siteId]
    );
    if (!site.rows.length) return null;

    const steps = await query(
        `SELECT step, status, result, error, started_at, completed_at
         FROM site_onboarding_steps WHERE site_id = $1 ORDER BY id ASC`,
        [siteId]
    );

    const licenses = await query(
        `SELECT plugin_slug, plugin_name, status FROM pending_license_requests WHERE site_id = $1`,
        [siteId]
    );

    return {
        status: site.rows[0].onboarding_status,
        steps: steps.rows,
        pendingLicenses: licenses.rows.filter(l => l.status === 'pending'),
    };
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { runOnboardingFlow, getOnboardingStatus };
