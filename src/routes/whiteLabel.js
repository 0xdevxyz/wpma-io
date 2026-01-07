/**
 * White-Label Routes
 * API-Endpunkte für White-Label Konfiguration
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const WhiteLabelService = require('../services/whiteLabelService');

router.use(authenticateToken);

/**
 * GET /api/v1/white-label/config
 * Holt die White-Label Konfiguration des Users
 */
router.get('/config', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const result = await WhiteLabelService.getWhiteLabelConfig(userId);
        res.json(result);
    } catch (error) {
        console.error('Get white-label config error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/white-label/config
 * Speichert/aktualisiert die White-Label Konfiguration
 */
router.post('/config', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const config = req.body;

        const result = await WhiteLabelService.saveWhiteLabelConfig(userId, config);
        res.json(result);
    } catch (error) {
        console.error('Save white-label config error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/white-label/domain/verify-token
 * Generiert ein Domain-Verifizierungstoken
 */
router.post('/domain/verify-token', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const { domain } = req.body;

        if (!domain) {
            return res.status(400).json({
                success: false,
                error: 'Domain erforderlich'
            });
        }

        const result = await WhiteLabelService.generateDomainVerificationToken(userId, domain);
        res.json(result);
    } catch (error) {
        console.error('Generate verification token error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/white-label/domain/verify
 * Verifiziert die Custom Domain via DNS
 */
router.post('/domain/verify', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const result = await WhiteLabelService.verifyCustomDomain(userId);
        res.json(result);
    } catch (error) {
        console.error('Verify domain error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/white-label/css
 * Holt das generierte Custom CSS
 */
router.get('/css', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const configResult = await WhiteLabelService.getWhiteLabelConfig(userId);
        
        if (!configResult.success) {
            return res.status(500).json(configResult);
        }

        const css = WhiteLabelService.generateCustomCss(configResult.data);
        res.setHeader('Content-Type', 'text/css');
        res.send(css);
    } catch (error) {
        console.error('Get custom CSS error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/white-label/preview-email
 * Generiert eine Vorschau der White-Label E-Mail
 */
router.post('/preview-email', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const { content } = req.body;

        const configResult = await WhiteLabelService.getWhiteLabelConfig(userId);
        if (!configResult.success) {
            return res.status(500).json(configResult);
        }

        const html = WhiteLabelService.generateEmailTemplate(
            configResult.data,
            content || '<h2>Test E-Mail</h2><p>Dies ist eine Vorschau Ihrer White-Label E-Mail.</p>'
        );

        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        console.error('Preview email error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Öffentlicher Endpoint für Domain-basierte Config (kein Auth)
router.get('/public/config/:domain', async (req, res) => {
    try {
        const { domain } = req.params;
        const result = await WhiteLabelService.getConfigByDomain(domain);
        
        // Filtere sensible Daten
        if (result.success && result.data) {
            delete result.data.customCss;
            delete result.data.emailFromAddress;
        }
        
        res.json(result);
    } catch (error) {
        console.error('Get public config error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

