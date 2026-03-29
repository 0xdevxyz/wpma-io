'use strict';

const { query } = require('../config/database');
const { getOnboardingStatus, runOnboardingFlow } = require('../services/onboardingService');

const getUserId = req => req.user?.userId;

async function checkSiteOwnership(siteId, userId) {
    const r = await query(
        'SELECT id FROM sites WHERE id = $1 AND user_id = $2 AND status = $3',
        [siteId, userId, 'active']
    );
    return r.rows.length > 0;
}

class OnboardingController {
    async getStatus(req, res) {
        try {
            const { siteId } = req.params;
            const userId = getUserId(req);

            if (!await checkSiteOwnership(siteId, userId)) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const status = await getOnboardingStatus(siteId);
            if (!status) {
                return res.status(404).json({ success: false, error: 'Keine Onboarding-Daten' });
            }

            res.json({ success: true, data: status });
        } catch (err) {
            console.error('Onboarding status error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async retryFlow(req, res) {
        try {
            const { siteId } = req.params;
            const userId = getUserId(req);

            if (!await checkSiteOwnership(siteId, userId)) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            await query(
                "UPDATE sites SET onboarding_status = 'pending' WHERE id = $1",
                [siteId]
            );

            await query('DELETE FROM site_onboarding_steps WHERE site_id = $1', [siteId]);

            runOnboardingFlow(siteId, userId).catch(err =>
                console.error(`[Onboarding] Retry-Fehler für Site ${siteId}:`, err.message)
            );

            res.json({ success: true, message: 'Onboarding neu gestartet' });
        } catch (err) {
            console.error('Onboarding retry error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async submitLicense(req, res) {
        try {
            const { siteId } = req.params;
            const { pluginSlug, licenseKey } = req.body;
            const userId = getUserId(req);

            if (!await checkSiteOwnership(siteId, userId)) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            if (!pluginSlug || !licenseKey) {
                return res.status(400).json({ success: false, error: 'pluginSlug und licenseKey erforderlich' });
            }

            await query(
                `UPDATE pending_license_requests
                 SET license_key = $1, status = 'provided', updated_at = NOW()
                 WHERE site_id = $2 AND plugin_slug = $3`,
                [licenseKey, siteId, pluginSlug]
            );

            res.json({ success: true, message: 'Lizenz gespeichert' });
        } catch (err) {
            console.error('License submit error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async skipLicense(req, res) {
        try {
            const { siteId } = req.params;
            const { pluginSlug } = req.body;
            const userId = getUserId(req);

            if (!await checkSiteOwnership(siteId, userId)) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            await query(
                `UPDATE pending_license_requests
                 SET status = 'skipped', updated_at = NOW()
                 WHERE site_id = $1 AND plugin_slug = $2`,
                [siteId, pluginSlug]
            );

            res.json({ success: true, message: 'Plugin-Update übersprungen' });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
}

module.exports = new OnboardingController();
