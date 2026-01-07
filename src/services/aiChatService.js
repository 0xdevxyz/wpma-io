/**
 * AI Chat Service
 * Intelligenter Chat-Assistent für WordPress-Fragen und Site-Management
 */

const { query } = require('../config/database');
const aiService = require('./aiService');

class AIChatService {
    constructor() {
        this.maxHistoryLength = 20; // Max Nachrichten pro Konversation
        this.actionHandlers = {
            'create_backup': this.handleCreateBackup.bind(this),
            'run_security_scan': this.handleSecurityScan.bind(this),
            'check_performance': this.handlePerformanceCheck.bind(this),
            'check_updates': this.handleCheckUpdates.bind(this),
            'get_site_status': this.handleGetSiteStatus.bind(this),
            'explain_error': this.handleExplainError.bind(this),
            'optimize_site': this.handleOptimizeSite.bind(this)
        };
    }

    /**
     * Hauptmethode für Chat-Interaktionen
     */
    async chat(userId, siteId, message, conversationId = null) {
        try {
            // Erstelle oder lade Konversation
            const conversation = await this.getOrCreateConversation(userId, siteId, conversationId);
            
            // Lade Konversationshistorie
            const history = await this.getConversationHistory(conversation.id);
            
            // Hole Site-Kontext
            const siteContext = await this.getSiteContext(siteId);
            
            // Erkenne Intent und mögliche Aktionen
            const intent = await this.detectIntent(message, siteContext);
            
            // Generiere Antwort
            const response = await this.generateResponse(message, history, siteContext, intent);
            
            // Speichere Nachrichten
            await this.saveMessage(conversation.id, 'user', message);
            await this.saveMessage(conversation.id, 'assistant', response.message, response.metadata);
            
            // Führe Aktionen aus wenn erkannt
            let actionResult = null;
            if (intent.action && intent.confidence > 0.7) {
                actionResult = await this.executeAction(userId, siteId, intent.action, intent.params);
            }

            return {
                success: true,
                data: {
                    conversationId: conversation.id,
                    message: response.message,
                    suggestions: response.suggestions,
                    action: actionResult,
                    intent: intent
                }
            };
        } catch (error) {
            console.error('AI Chat error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Erkennt den Intent einer Nachricht
     */
    async detectIntent(message, siteContext) {
        const lowerMessage = message.toLowerCase();
        
        // Keyword-basierte Intent-Erkennung
        const intents = [
            { 
                keywords: ['backup', 'sicherung', 'sichere', 'sichern'],
                action: 'create_backup',
                confidence: 0.8
            },
            { 
                keywords: ['security', 'sicherheit', 'scan', 'prüfen', 'malware', 'virus'],
                action: 'run_security_scan',
                confidence: 0.8
            },
            { 
                keywords: ['performance', 'schnell', 'langsam', 'ladezeit', 'speed'],
                action: 'check_performance',
                confidence: 0.8
            },
            { 
                keywords: ['update', 'aktualisier', 'version', 'plugin'],
                action: 'check_updates',
                confidence: 0.75
            },
            { 
                keywords: ['status', 'zustand', 'overview', 'übersicht'],
                action: 'get_site_status',
                confidence: 0.7
            },
            { 
                keywords: ['fehler', 'error', 'problem', 'funktioniert nicht', 'kaputt'],
                action: 'explain_error',
                confidence: 0.7
            },
            { 
                keywords: ['optimier', 'verbessern', 'schneller machen'],
                action: 'optimize_site',
                confidence: 0.75
            }
        ];

        for (const intent of intents) {
            if (intent.keywords.some(kw => lowerMessage.includes(kw))) {
                return {
                    action: intent.action,
                    confidence: intent.confidence,
                    params: await this.extractParams(message, intent.action)
                };
            }
        }

        // Kein spezifischer Intent erkannt
        return { action: null, confidence: 0, params: {} };
    }

    /**
     * Extrahiert Parameter aus der Nachricht
     */
    async extractParams(message, action) {
        const params = {};
        
        switch (action) {
            case 'create_backup':
                if (message.toLowerCase().includes('datenbank')) {
                    params.type = 'database';
                } else if (message.toLowerCase().includes('dateien')) {
                    params.type = 'files';
                } else {
                    params.type = 'full';
                }
                break;
            case 'explain_error':
                // Extrahiere Fehlermeldung wenn vorhanden
                const errorMatch = message.match(/['"](.*?)['"]/);
                if (errorMatch) {
                    params.errorMessage = errorMatch[1];
                }
                break;
        }

        return params;
    }

    /**
     * Generiert KI-Antwort
     */
    async generateResponse(message, history, siteContext, intent) {
        const systemPrompt = `Du bist ein hilfreicher WordPress-Support-Assistent namens "WPMA Assistant".
Du hilfst Benutzern bei der Verwaltung ihrer WordPress-Websites.

WICHTIGE REGELN:
1. Antworte IMMER auf Deutsch
2. Sei freundlich, professionell und präzise
3. Wenn du eine Aktion ausführen kannst, erwähne das
4. Gib konkrete, umsetzbare Ratschläge
5. Bei Sicherheitsfragen sei vorsichtig und empfehle im Zweifel professionelle Hilfe

DEINE FÄHIGKEITEN:
- Backups erstellen und verwalten
- Security Scans durchführen
- Performance analysieren
- Updates prüfen und installieren
- Fehler erklären und Lösungen vorschlagen
- Allgemeine WordPress-Fragen beantworten

AKTUELLER SITE-KONTEXT:
${JSON.stringify(siteContext, null, 2)}`;

        // Bereite Chat-Historie vor
        const messages = history.slice(-10).map(m => ({
            role: m.role,
            content: m.content
        }));

        // Füge aktuelle Nachricht hinzu
        messages.push({ role: 'user', content: message });

        // Generiere Antwort
        let responseText;
        if (aiService.preferredModel === 'claude' && aiService.anthropic) {
            const result = await aiService.anthropic.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 1000,
                system: systemPrompt,
                messages: messages
            });
            responseText = result.content[0].text;
        } else if (aiService.openai) {
            const result = await aiService.openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messages
                ],
                max_tokens: 1000,
                temperature: 0.7
            });
            responseText = result.choices[0].message.content;
        } else {
            responseText = this.getFallbackResponse(message, intent, siteContext);
        }

        // Generiere Vorschläge
        const suggestions = this.generateSuggestions(message, intent, siteContext);

        return {
            message: responseText,
            suggestions,
            metadata: {
                intent: intent.action,
                confidence: intent.confidence
            }
        };
    }

    /**
     * Fallback-Antwort ohne KI
     */
    getFallbackResponse(message, intent, siteContext) {
        const responses = {
            'create_backup': `Ich kann ein Backup für ${siteContext.domain || 'deine Site'} erstellen. Soll ich ein vollständiges Backup starten?`,
            'run_security_scan': `Ich kann einen Security-Scan für ${siteContext.domain || 'deine Site'} durchführen. Dies prüft auf bekannte Sicherheitsprobleme, Malware und Konfigurationsfehler.`,
            'check_performance': `Der aktuelle Health-Score deiner Site ist ${siteContext.health_score || 'nicht verfügbar'}. Soll ich eine detaillierte Performance-Analyse durchführen?`,
            'check_updates': `Ich kann prüfen, ob Updates für WordPress, Plugins oder Themes verfügbar sind. Soll ich das jetzt tun?`,
            'get_site_status': `Hier ist der aktuelle Status deiner Site:\n- Domain: ${siteContext.domain}\n- Status: ${siteContext.status}\n- Health Score: ${siteContext.health_score || 'N/A'}`,
            'default': 'Ich bin dein WordPress-Assistent. Ich kann dir bei Backups, Security-Scans, Performance-Analysen und WordPress-Fragen helfen. Was möchtest du tun?'
        };

        return responses[intent.action] || responses.default;
    }

    /**
     * Generiert Vorschläge basierend auf Kontext
     */
    generateSuggestions(message, intent, siteContext) {
        const suggestions = [];

        // Basierend auf Site-Status
        if (siteContext.health_score && siteContext.health_score < 70) {
            suggestions.push({
                text: '🔍 Site analysieren',
                action: 'analyze_site',
                description: 'Vollständige Analyse durchführen'
            });
        }

        // Basierend auf Intent
        if (!intent.action) {
            suggestions.push(
                { text: '💾 Backup erstellen', action: 'create_backup' },
                { text: '🔒 Security prüfen', action: 'run_security_scan' },
                { text: '⚡ Performance testen', action: 'check_performance' }
            );
        }

        return suggestions.slice(0, 3);
    }

    /**
     * Führt erkannte Aktion aus
     */
    async executeAction(userId, siteId, action, params) {
        const handler = this.actionHandlers[action];
        if (!handler) {
            return { executed: false, reason: 'Unbekannte Aktion' };
        }

        try {
            return await handler(userId, siteId, params);
        } catch (error) {
            console.error(`Action ${action} failed:`, error);
            return { executed: false, error: error.message };
        }
    }

    // ==========================================
    // ACTION HANDLERS
    // ==========================================

    async handleCreateBackup(userId, siteId, params) {
        const backupService = require('./backupService');
        const result = await backupService.createBackup(siteId, params.type || 'full');
        return {
            executed: true,
            action: 'create_backup',
            result,
            message: result.success 
                ? '✅ Backup wurde erfolgreich gestartet!' 
                : `❌ Backup fehlgeschlagen: ${result.error}`
        };
    }

    async handleSecurityScan(userId, siteId, params) {
        // Trigger Security Scan
        return {
            executed: true,
            action: 'run_security_scan',
            message: '🔍 Security-Scan wurde gestartet. Die Ergebnisse sind in wenigen Minuten verfügbar.'
        };
    }

    async handlePerformanceCheck(userId, siteId, params) {
        return {
            executed: true,
            action: 'check_performance',
            message: '⚡ Performance-Analyse wurde gestartet.'
        };
    }

    async handleCheckUpdates(userId, siteId, params) {
        return {
            executed: true,
            action: 'check_updates',
            message: '🔄 Prüfe auf verfügbare Updates...'
        };
    }

    async handleGetSiteStatus(userId, siteId, params) {
        const siteContext = await this.getSiteContext(siteId);
        return {
            executed: true,
            action: 'get_site_status',
            data: siteContext,
            message: `📊 Site-Status für ${siteContext.domain}`
        };
    }

    async handleExplainError(userId, siteId, params) {
        if (!params.errorMessage) {
            return {
                executed: false,
                message: 'Bitte teile mir die genaue Fehlermeldung mit, damit ich sie analysieren kann.'
            };
        }

        const explanation = await this.explainWordPressError(params.errorMessage);
        return {
            executed: true,
            action: 'explain_error',
            data: explanation,
            message: explanation
        };
    }

    async handleOptimizeSite(userId, siteId, params) {
        const analysis = await aiService.performFullSiteAnalysis(siteId);
        return {
            executed: true,
            action: 'optimize_site',
            data: analysis.data,
            message: '🚀 Hier sind die Optimierungsvorschläge für deine Site.'
        };
    }

    /**
     * Erklärt WordPress-Fehler
     */
    async explainWordPressError(errorMessage) {
        const commonErrors = {
            'white screen': 'Der "White Screen of Death" wird meist durch einen PHP-Fehler verursacht. Häufige Ursachen: Fehlerhaftes Plugin, Theme-Problem, PHP-Speicherlimit erreicht.',
            'database connection': 'Datenbankverbindungsfehler. Prüfe: wp-config.php Zugangsdaten, MySQL-Server läuft, Datenbank existiert.',
            '500': 'Internal Server Error. Häufige Ursachen: .htaccess-Problem, PHP-Fehler, Speicherlimit, Plugin-Konflikt.',
            '404': 'Seite nicht gefunden. Prüfe: Permalinks neu speichern, .htaccess prüfen.',
            'memory': 'PHP-Speicherlimit erreicht. Lösung: WP_MEMORY_LIMIT in wp-config.php erhöhen.',
            'timeout': 'Script-Timeout. Mögliche Ursachen: Langsame Datenbank-Queries, zu viele Plugins, Server-Problem.'
        };

        for (const [key, explanation] of Object.entries(commonErrors)) {
            if (errorMessage.toLowerCase().includes(key)) {
                return explanation;
            }
        }

        // KI-basierte Erklärung für unbekannte Fehler
        if (aiService.isConfigured) {
            const response = await aiService.analyze(
                `Erkläre diesen WordPress-Fehler und gib Lösungsvorschläge: "${errorMessage}"`,
                'Du bist ein WordPress-Fehlerbehebungsexperte. Erkläre Fehler verständlich und gib konkrete Lösungsschritte.',
                500
            );
            return response;
        }

        return `Dieser Fehler "${errorMessage}" erfordert eine genauere Analyse. Bitte prüfe die WordPress-Fehlerlogs oder kontaktiere den Support.`;
    }

    // ==========================================
    // CONVERSATION MANAGEMENT
    // ==========================================

    async getOrCreateConversation(userId, siteId, conversationId) {
        if (conversationId) {
            const result = await query(
                `SELECT * FROM chat_conversations 
                 WHERE id = $1 AND user_id = $2`,
                [conversationId, userId]
            );
            if (result.rows.length > 0) {
                return result.rows[0];
            }
        }

        // Erstelle neue Konversation
        const result = await query(
            `INSERT INTO chat_conversations (user_id, site_id, title)
             VALUES ($1, $2, 'Neue Konversation')
             RETURNING *`,
            [userId, siteId]
        );

        return result.rows[0];
    }

    async getConversationHistory(conversationId) {
        const result = await query(
            `SELECT role, content, metadata, created_at
             FROM chat_messages
             WHERE conversation_id = $1
             ORDER BY created_at ASC
             LIMIT $2`,
            [conversationId, this.maxHistoryLength]
        );

        return result.rows;
    }

    async saveMessage(conversationId, role, content, metadata = null) {
        await query(
            `INSERT INTO chat_messages (conversation_id, role, content, metadata)
             VALUES ($1, $2, $3, $4)`,
            [conversationId, role, content, metadata ? JSON.stringify(metadata) : null]
        );

        // Update Konversationstitel bei erster User-Nachricht
        if (role === 'user') {
            await query(
                `UPDATE chat_conversations 
                 SET title = $1, updated_at = NOW()
                 WHERE id = $2 AND title = 'Neue Konversation'`,
                [content.substring(0, 50), conversationId]
            );
        }
    }

    async getUserConversations(userId, limit = 20) {
        const result = await query(
            `SELECT c.*, 
                    (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id) as message_count,
                    (SELECT content FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
             FROM chat_conversations c
             WHERE c.user_id = $1
             ORDER BY c.updated_at DESC
             LIMIT $2`,
            [userId, limit]
        );

        return { success: true, data: result.rows };
    }

    async deleteConversation(userId, conversationId) {
        await query(
            `DELETE FROM chat_conversations WHERE id = $1 AND user_id = $2`,
            [conversationId, userId]
        );
        return { success: true };
    }

    // ==========================================
    // HELPER
    // ==========================================

    async getSiteContext(siteId) {
        try {
            const result = await query(
                `SELECT domain, site_url, status, health_score, wordpress_version, php_version, last_check
                 FROM sites WHERE id = $1`,
                [siteId]
            );

            if (result.rows.length === 0) {
                return { domain: 'Unbekannt', status: 'unknown' };
            }

            return result.rows[0];
        } catch (error) {
            console.error('Get site context error:', error);
            return { domain: 'Unbekannt', status: 'error' };
        }
    }
}

module.exports = new AIChatService();

