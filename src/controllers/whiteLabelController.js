const WhiteLabelService = require('../services/whiteLabelService');

class WhiteLabelController {
    async getWhiteLabelConfig(req, res) {
        try {
            const userId = req.user?.userId;
            const result = await WhiteLabelService.getWhiteLabelConfig(userId);
            res.json(result);
        } catch (error) {
            console.error('Get white-label config error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async saveWhiteLabelConfig(req, res) {
        try {
            const userId = req.user?.userId;
            const config = req.body;

            const result = await WhiteLabelService.saveWhiteLabelConfig(userId, config);
            res.json(result);
        } catch (error) {
            console.error('Save white-label config error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async generateDomainVerificationToken(req, res) {
        try {
            const userId = req.user?.userId;
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
    }

    async verifyCustomDomain(req, res) {
        try {
            const userId = req.user?.userId;
            const result = await WhiteLabelService.verifyCustomDomain(userId);
            res.json(result);
        } catch (error) {
            console.error('Verify domain error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getCustomCss(req, res) {
        try {
            const userId = req.user?.userId;
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
    }

    async previewEmail(req, res) {
        try {
            const userId = req.user?.userId;
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
    }

    async getPublicConfig(req, res) {
        try {
            const { domain } = req.params;
            const result = await WhiteLabelService.getConfigByDomain(domain);

            if (result.success && result.data) {
                delete result.data.customCss;
                delete result.data.emailFromAddress;
            }

            res.json(result);
        } catch (error) {
            console.error('Get public config error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new WhiteLabelController();
