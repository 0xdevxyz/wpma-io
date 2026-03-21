const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');
const AIService = require('../services/aiService');
const { chatJSON } = require('../services/llmService');

// AI Status (öffentlich - keine Auth nötig)
router.get('/status', async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                configured: AIService.isConfigured,
                provider: AIService.preferredModel,
                features: {
                    full_analysis: true,
                    proactive_detection: true,
                    auto_fix: true,
                    chat: AIService.isConfigured,
                    security_recommendations: true,
                    performance_analysis: true,
                    update_analysis: true
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// All other routes require authentication
router.use(authenticateToken);

// Hilfsfunktion für Site-Zugriffsprüfung
async function checkSiteAccess(siteId, userId) {
    const result = await query(
        'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
        [siteId, userId]
    );
    return result.rows.length > 0;
}

// ==========================================
// AI ENDPOINTS
// ==========================================

// Gespeicherte AI Insights abrufen
router.get('/:siteId/insights', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        
        if (!await checkSiteAccess(siteId, userId)) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }
        
        const result = await AIService.getAIInsights(siteId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Vollständige KI-Analyse durchführen
router.post('/:siteId/analyze', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        
        if (!await checkSiteAccess(siteId, userId)) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }
        
        const result = await AIService.performFullSiteAnalysis(siteId);
        res.json(result);
    } catch (error) {
        console.error('AI Analyze error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Proaktive Problemerkennung
router.get('/:siteId/proactive', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        
        if (!await checkSiteAccess(siteId, userId)) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }
        
        const result = await AIService.detectProactiveIssues(siteId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update-Sicherheitsanalyse
router.post('/:siteId/analyze-updates', async (req, res) => {
    try {
        const { siteId } = req.params;
        const { updateType, updates } = req.body;
        const userId = req.user?.userId || req.user?.id;
        
        if (!await checkSiteAccess(siteId, userId)) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }
        
        const result = await AIService.analyzeUpdateSafety(siteId, updateType, updates);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Auto-Fix generieren
router.post('/:siteId/auto-fix', async (req, res) => {
    try {
        const { siteId } = req.params;
        const { problem } = req.body;
        const userId = req.user?.userId || req.user?.id;
        
        if (!await checkSiteAccess(siteId, userId)) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }
        
        const result = await AIService.generateAutoFix(siteId, problem);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// KI-Chat
router.post('/:siteId/chat', async (req, res) => {
    try {
        const { siteId } = req.params;
        const { message, history } = req.body;
        const userId = req.user?.userId || req.user?.id;
        
        if (!await checkSiteAccess(siteId, userId)) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }
        
        if (!message) {
            return res.status(400).json({ success: false, error: 'Nachricht ist erforderlich' });
        }
        
        const result = await AIService.chat(siteId, message, history || []);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Security-Empfehlungen
router.post('/:siteId/security-recommendations', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        
        if (!await checkSiteAccess(siteId, userId)) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }
        
        const siteData = await AIService.collectSiteData(siteId);
        if (!siteData.success) {
            return res.status(404).json(siteData);
        }
        
        const result = await AIService.generateSecurityRecommendations(siteData.data);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Performance-Analyse
router.post('/:siteId/performance-analysis', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        
        if (!await checkSiteAccess(siteId, userId)) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }
        
        const siteData = await AIService.collectSiteData(siteId);
        if (!siteData.success) {
            return res.status(404).json(siteData);
        }
        
        const result = await AIService.analyzePerformanceMetrics({
            site_id: siteId,
            ...siteData.data.performance
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── AI Risk Analysis vor Updates ────────────────────────────────────────────

/**
 * POST /api/v1/ai/:siteId/risk-analysis
 * Holt Live-Plugin-Daten vom WP-Agent, analysiert jedes Update mit Claude
 * und gibt strukturierte Risikoeinschätzung zurück.
 */
router.post('/:siteId/risk-analysis', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;

        if (!await checkSiteAccess(siteId, userId)) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }

        // Site-Daten holen
        const siteResult = await query(
            'SELECT domain, site_url, api_key, wordpress_version, php_version FROM sites WHERE id = $1',
            [siteId]
        );
        if (siteResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }
        const site = siteResult.rows[0];
        const siteUrl = (site.site_url || '').replace(/\/$/, '');

        // Live Plugin-Daten vom WP-Agent holen
        let plugins = [];
        let wpVersion = site.wordpress_version || 'unbekannt';
        let phpVersion = site.php_version || 'unbekannt';

        try {
            const pluginsResp = await axios.get(`${siteUrl}/wp-json/wpma/v1/plugins`, {
                headers: { 'X-WPMA-Key': site.api_key },
                timeout: 15000,
            });
            const raw = pluginsResp.data?.data ?? pluginsResp.data ?? {};
            const list = Array.isArray(raw) ? raw : (raw.plugins || []);
            plugins = list.filter(p => p.update_available);
        } catch (e) {
            // Fallback: Keine Live-Daten — Analyse trotzdem mit Basis-Infos
        }

        if (plugins.length === 0) {
            return res.json({
                success: true,
                data: {
                    overallRisk: 'low',
                    plugins: [],
                    coreRisk: null,
                    summary: 'Keine ausstehenden Plugin-Updates gefunden.',
                    analyzedAt: new Date().toISOString(),
                    siteInfo: { wpVersion, phpVersion, domain: site.domain },
                }
            });
        }

        // Claude-Analyse: strukturiertes JSON pro Plugin
        const system = `Du bist ein WordPress-Sicherheitsexperte. Bewerte Update-Risiken präzise und strukturiert.
Antworte NUR mit validem JSON, ohne Markdown-Codeblöcke.`;

        const prompt = `Analysiere folgende WordPress Plugin-Updates auf Risiken:

Site: ${site.domain}
WordPress: ${wpVersion}
PHP: ${phpVersion}

Ausstehende Updates:
${plugins.map(p => `- ${p.name} (${p.version} → ${p.new_version || 'latest'})`).join('\n')}

Gib für jedes Plugin eine Bewertung zurück. Berücksichtige:
- Bekannte Breaking Changes zwischen Versionen
- Plugin-Typ (Core-Plugins wie WooCommerce/Yoast = mehr Risiko)
- PHP/WP Kompatibilität
- Major/Minor/Patch Versionssprung

Antworte mit diesem JSON:
{
  "overallRisk": "low|medium|high",
  "summary": "Kurze Gesamteinschätzung auf Deutsch",
  "plugins": [
    {
      "name": "Plugin Name",
      "slug": "plugin-slug",
      "currentVersion": "x.y.z",
      "newVersion": "a.b.c",
      "riskLevel": "low|medium|high|critical",
      "riskScore": 1-10,
      "recommendation": "safe|caution|skip|manual_review",
      "reasons": ["Grund 1", "Grund 2"],
      "warnings": ["Warnung falls vorhanden"]
    }
  ]
}`;

        let analysis;
        try {
            analysis = await chatJSON({ system, prompt, model: 'smart', maxTokens: 2000 });
        } catch (e) {
            // Fallback: heuristisch basierend auf Versionsnummern
            analysis = buildHeuristicAnalysis(plugins, wpVersion, phpVersion);
        }

        if (!analysis || !analysis.plugins) {
            analysis = buildHeuristicAnalysis(plugins, wpVersion, phpVersion);
        }

        return res.json({
            success: true,
            data: {
                ...analysis,
                analyzedAt: new Date().toISOString(),
                siteInfo: { wpVersion, phpVersion, domain: site.domain },
            }
        });

    } catch (error) {
        console.error('Risk analysis error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

function buildHeuristicAnalysis(plugins, wpVersion, phpVersion) {
    const analyzed = plugins.map(p => {
        const current = p.version || '0.0.0';
        const next = p.new_version || '0.0.1';
        const currentMajor = parseInt(current.split('.')[0] || '0');
        const nextMajor = parseInt(next.split('.')[0] || '0');
        const isMajor = nextMajor > currentMajor;
        const highRiskPlugins = ['woocommerce', 'elementor', 'yoast', 'wpforms', 'gravity-forms', 'contact-form-7'];
        const isHighRisk = highRiskPlugins.some(s => (p.slug || p.name || '').toLowerCase().includes(s));

        let riskLevel = 'low';
        let riskScore = 2;
        let recommendation = 'safe';
        const reasons = [];
        const warnings = [];

        if (isMajor) {
            riskLevel = 'high'; riskScore = 7; recommendation = 'manual_review';
            reasons.push(`Major-Update (${currentMajor}.x → ${nextMajor}.x) — Breaking Changes möglich`);
            warnings.push('Vor dem Update testen');
        } else if (isHighRisk) {
            riskLevel = 'medium'; riskScore = 5; recommendation = 'caution';
            reasons.push('Kritisches Plugin — erhöhte Sorgfalt empfohlen');
        } else {
            reasons.push('Reguläres Minor/Patch-Update');
        }

        return { name: p.name, slug: p.slug || '', currentVersion: current, newVersion: next, riskLevel, riskScore, recommendation, reasons, warnings };
    });

    const maxScore = Math.max(...analyzed.map(p => p.riskScore));
    const overallRisk = maxScore >= 7 ? 'high' : maxScore >= 4 ? 'medium' : 'low';
    return {
        overallRisk,
        summary: `${plugins.length} Plugin-Update(s) analysiert. ${analyzed.filter(p => p.recommendation !== 'safe').length} erfordern Aufmerksamkeit.`,
        plugins: analyzed,
    };
}

module.exports = router;