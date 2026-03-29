'use strict';

const selfHealingService = require('../services/selfHealingService');

class SelfHealingController {
    async analyzeProblem(req, res) {
        try {
            const { siteId, error, context, logs } = req.body;

            if (!siteId || !error) {
                return res.status(400).json({
                    success: false,
                    error: 'siteId und error sind erforderlich'
                });
            }

            const result = await selfHealingService.analyzeProblem(siteId, {
                error,
                context,
                logs
            });

            res.json(result);
        } catch (error) {
            console.error('Analyze problem error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async applyFix(req, res) {
        try {
            const { siteId, fixId, autoApply, createSnapshot } = req.body;

            if (!siteId || !fixId) {
                return res.status(400).json({
                    success: false,
                    error: 'siteId und fixId sind erforderlich'
                });
            }

            const result = await selfHealingService.applyFix(
                siteId,
                req.user.userId,
                fixId,
                { autoApply, createSnapshot }
            );

            res.json(result);
        } catch (error) {
            console.error('Apply fix error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async autoHeal(req, res) {
        try {
            const { siteId, error, context, logs } = req.body;

            if (!siteId || !error) {
                return res.status(400).json({
                    success: false,
                    error: 'siteId und error sind erforderlich'
                });
            }

            const result = await selfHealingService.autoHeal(siteId, {
                error,
                context,
                logs
            });

            res.json(result);
        } catch (error) {
            console.error('Auto heal error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getHealingHistory(req, res) {
        try {
            const { siteId } = req.params;

            res.json({
                success: true,
                data: []
            });
        } catch (error) {
            console.error('Get healing history error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new SelfHealingController();
