const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { query } = require('../config/database');

class AIService {
    constructor() {
        // OpenRouter für OpenAI-kompatible Modelle
        const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
        if (openRouterKey) {
            this.openai = new OpenAI({
                baseURL: "https://openrouter.ai/api/v1",
                apiKey: openRouterKey,
            });
        }
        
        // Anthropic Claude für bessere Analyse
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        if (anthropicKey) {
            this.anthropic = new Anthropic({ apiKey: anthropicKey });
        }
        
        this.isConfigured = Boolean(openRouterKey || anthropicKey);
        this.preferredModel = anthropicKey ? 'claude' : 'openai';
        
        console.log(`AI Service initialized. Provider: ${this.preferredModel}, Configured: ${this.isConfigured}`);
    }

    // Hauptmethode für KI-Analyse - wählt automatisch das beste Modell
    async analyze(prompt, systemPrompt, maxTokens = 1000) {
        if (!this.isConfigured) {
            return this.getFallbackAnalysis(prompt);
        }

        try {
            if (this.preferredModel === 'claude' && this.anthropic) {
                const response = await this.anthropic.messages.create({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: maxTokens,
                    system: systemPrompt,
                    messages: [{ role: 'user', content: prompt }]
                });
                return response.content[0].text;
            } else if (this.openai) {
                const response = await this.openai.chat.completions.create({
                    model: 'gpt-4-turbo-preview',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: maxTokens,
                    temperature: 0.3
                });
                return response.choices[0].message.content;
            }
        } catch (error) {
            console.error('AI Analysis error:', error.message);
            return this.getFallbackAnalysis(prompt);
        }
    }

    // Fallback wenn keine API konfiguriert
    getFallbackAnalysis(prompt) {
        return `
ANALYSE (Automatisch generiert):

Basierend auf den bereitgestellten Daten wurden folgende Empfehlungen identifiziert:

SICHERHEIT:
- Stellen Sie sicher, dass alle Plugins aktuell sind
- Aktivieren Sie SSL/HTTPS falls nicht aktiv
- Deaktivieren Sie den Debug-Modus in der Produktion
- Verwenden Sie starke Passwörter

PERFORMANCE:
- Optimieren Sie Bilder mit WebP-Format
- Aktivieren Sie Browser-Caching
- Minimieren Sie CSS und JavaScript
- Verwenden Sie ein CDN

WARTUNG:
- Erstellen Sie regelmäßige Backups
- Überwachen Sie die Uptime
- Aktualisieren Sie WordPress Core regelmäßig

Hinweis: Für detailliertere KI-Analysen konfigurieren Sie bitte einen API-Key (ANTHROPIC_API_KEY oder OPENROUTER_API_KEY).
        `;
    }

    async generateSecurityRecommendations(siteData) {
        try {
            if (!this.openai) {
                return { success: false, error: 'Kein AI-API-Key konfiguriert' };
            }
            const prompt = this.buildSecurityPrompt(siteData);

            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "Du bist ein WordPress-Sicherheitsexperte. Analysiere die bereitgestellten Daten und gib spezifische, umsetzbare Sicherheitsempfehlungen."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 1000,
                temperature: 0.3
            });

            const recommendations = response.choices[0].message.content;
            
            // Parse recommendations into structured format
            const structuredRecommendations = this.parseSecurityRecommendations(recommendations);
            
            // Store in database
            await this.storeAIInsight(siteData.site_id, 'security', structuredRecommendations);
            
            return {
                success: true,
                recommendations: structuredRecommendations
            };
        } catch (error) {
            console.error('AI Security analysis error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async analyzePerformanceMetrics(metrics) {
        try {
            if (!this.openai) {
                return { success: false, error: 'Kein AI-API-Key konfiguriert' };
            }
            const prompt = this.buildPerformancePrompt(metrics);

            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "Du bist ein WordPress-Performance-Experte. Analysiere die Performance-Metriken und gib Optimierungsempfehlungen."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 800,
                temperature: 0.3
            });

            const analysis = response.choices[0].message.content;
            const structuredAnalysis = this.parsePerformanceAnalysis(analysis);
            
            await this.storeAIInsight(metrics.site_id, 'performance', structuredAnalysis);
            
            return {
                success: true,
                analysis: structuredAnalysis
            };
        } catch (error) {
            console.error('AI Performance analysis error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async predictThreats(securityData) {
        try {
            if (!this.openai) {
                return { success: false, error: 'Kein AI-API-Key konfiguriert' };
            }
            const prompt = this.buildThreatPredictionPrompt(securityData);

            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "Du bist ein Cybersecurity-Experte. Analysiere die Sicherheitsdaten und identifiziere potenzielle Bedrohungen und Risiken."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 600,
                temperature: 0.2
            });

            const predictions = response.choices[0].message.content;
            const structuredPredictions = this.parseThreatPredictions(predictions);
            
            await this.storeAIInsight(securityData.site_id, 'threat_prediction', structuredPredictions);
            
            return {
                success: true,
                predictions: structuredPredictions
            };
        } catch (error) {
            console.error('AI Threat prediction error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async generateAutomatedResponse(incident) {
        try {
            if (!this.openai) {
                return { success: false, error: 'Kein AI-API-Key konfiguriert' };
            }
            const prompt = this.buildIncidentResponsePrompt(incident);

            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "Du bist ein WordPress-Sicherheitsberater. Erstelle eine automatisierte Antwort für Sicherheitsvorfälle."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 500,
                temperature: 0.3
            });

            return {
                success: true,
                response: response.choices[0].message.content
            };
        } catch (error) {
            console.error('AI Automated response error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    buildSecurityPrompt(siteData) {
        return `
WordPress Site Sicherheitsanalyse:

Site: ${siteData.domain}
WordPress Version: ${siteData.wordpress_version}
PHP Version: ${siteData.php_version}
SSL: ${siteData.security_status?.ssl_enabled ? 'Aktiviert' : 'Nicht aktiviert'}
Debug Mode: ${siteData.security_status?.debug_mode ? 'Aktiviert' : 'Deaktiviert'}
Admin Username: ${siteData.security_status?.admin_username}
Failed Logins (24h): ${siteData.security_status?.failed_logins_24h}

Aktive Plugins: ${siteData.active_plugins?.length || 0}
Theme: ${siteData.theme?.name || 'Unbekannt'}

Datei-Berechtigungen:
${JSON.stringify(siteData.security_status?.file_permissions || {}, null, 2)}

Bitte analysiere diese Daten und gib spezifische Sicherheitsempfehlungen in folgendem Format:

KRITISCH:
- Kritische Sicherheitsprobleme mit sofortigen Handlungsempfehlungen

WARNUNG:
- Wichtige Sicherheitsprobleme mit Handlungsempfehlungen

INFO:
- Allgemeine Sicherheitsverbesserungen

OPTIMIERUNG:
- Performance- und Sicherheitsoptimierungen
        `;
    }

    buildPerformancePrompt(metrics) {
        return `
WordPress Performance-Analyse:

Page Load Time: ${metrics.page_load_time}ms
Memory Usage: ${metrics.memory_usage} bytes
Peak Memory: ${metrics.peak_memory} bytes
Database Size: ${metrics.database_size} MB
Core Web Vitals: ${JSON.stringify(metrics.core_web_vitals || {}, null, 2)}

Bitte analysiere diese Performance-Daten und gib Optimierungsempfehlungen in folgendem Format:

KRITISCH:
- Kritische Performance-Probleme

WARNUNG:
- Performance-Verbesserungen

OPTIMIERUNG:
- Allgemeine Optimierungen

EMPFEHLUNGEN:
- Spezifische Handlungsempfehlungen
        `;
    }

    buildThreatPredictionPrompt(securityData) {
        return `
Bedrohungsvorhersage basierend auf Sicherheitsdaten:

Site: ${securityData.domain}
Sicherheitsstatus: ${JSON.stringify(securityData.security_status, null, 2)}
Vulnerabilities: ${JSON.stringify(securityData.vulnerabilities || [], null, 2)}
Failed Logins: ${securityData.failed_logins || 0}

Bitte analysiere diese Daten und identifiziere potenzielle Bedrohungen:

HOHE BEDROHUNG:
- Sofortige Bedrohungen

MITTEL BEDROHUNG:
- Potenzielle Risiken

NIEDRIGE BEDROHUNG:
- Zu überwachende Bereiche

VORHERSAGE:
- Erwartete Bedrohungen in den nächsten 30 Tagen
        `;
    }

    buildIncidentResponsePrompt(incident) {
        return `
Sicherheitsvorfall: ${incident.type}
Schweregrad: ${incident.severity}
Beschreibung: ${incident.description}
Betroffene Komponenten: ${incident.affected_components}

Erstelle eine automatisierte Antwort mit:
1. Sofortige Maßnahmen
2. Untersuchungsschritte
3. Präventive Maßnahmen
4. Benachrichtigungen
        `;
    }

    parseSecurityRecommendations(recommendations) {
        const sections = {
            critical: [],
            warning: [],
            info: [],
            optimization: []
        };

        const lines = recommendations.split('\n');
        let currentSection = null;

        for (const line of lines) {
            if (line.includes('KRITISCH:')) {
                currentSection = 'critical';
            } else if (line.includes('WARNUNG:')) {
                currentSection = 'warning';
            } else if (line.includes('INFO:')) {
                currentSection = 'info';
            } else if (line.includes('OPTIMIERUNG:')) {
                currentSection = 'optimization';
            } else if (line.trim().startsWith('-') && currentSection) {
                sections[currentSection].push(line.trim().substring(1).trim());
            }
        }

        return sections;
    }

    parsePerformanceAnalysis(analysis) {
        const sections = {
            critical: [],
            warning: [],
            optimization: [],
            recommendations: []
        };

        const lines = analysis.split('\n');
        let currentSection = null;

        for (const line of lines) {
            if (line.includes('KRITISCH:')) {
                currentSection = 'critical';
            } else if (line.includes('WARNUNG:')) {
                currentSection = 'warning';
            } else if (line.includes('OPTIMIERUNG:')) {
                currentSection = 'optimization';
            } else if (line.includes('EMPFEHLUNGEN:')) {
                currentSection = 'recommendations';
            } else if (line.trim().startsWith('-') && currentSection) {
                sections[currentSection].push(line.trim().substring(1).trim());
            }
        }

        return sections;
    }

    parseThreatPredictions(predictions) {
        const sections = {
            high_threat: [],
            medium_threat: [],
            low_threat: [],
            forecast: []
        };

        const lines = predictions.split('\n');
        let currentSection = null;

        for (const line of lines) {
            if (line.includes('HOHE BEDROHUNG:')) {
                currentSection = 'high_threat';
            } else if (line.includes('MITTEL BEDROHUNG:')) {
                currentSection = 'medium_threat';
            } else if (line.includes('NIEDRIGE BEDROHUNG:')) {
                currentSection = 'low_threat';
            } else if (line.includes('VORHERSAGE:')) {
                currentSection = 'forecast';
            } else if (line.trim().startsWith('-') && currentSection) {
                sections[currentSection].push(line.trim().substring(1).trim());
            }
        }

        return sections;
    }

    async storeAIInsight(siteId, insightType, data) {
        try {
            await query(
                `INSERT INTO ai_insights (site_id, insight_type, title, description, data)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    siteId,
                    insightType,
                    `${insightType.charAt(0).toUpperCase() + insightType.slice(1)} Analysis`,
                    `AI-generated ${insightType} insights`,
                    JSON.stringify(data)
                ]
            );
        } catch (error) {
            console.error('Error storing AI insight:', error);
        }
    }

    async getAIInsights(siteId) {
        try {
            const result = await query(
                `SELECT * FROM ai_insights 
                 WHERE site_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT 10`,
                [siteId]
            );

            return {
                success: true,
                insights: result.rows
            };
        } catch (error) {
            console.error('Error getting AI insights:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ==========================================
    // NEUE ERWEITERTE KI-FUNKTIONEN
    // ==========================================

    /**
     * Vollständige Site-Analyse - kombiniert alle Daten
     */
    async performFullSiteAnalysis(siteId) {
        try {
            // Sammle alle Daten
            const siteData = await this.collectSiteData(siteId);
            
            if (!siteData.success) {
                return { success: false, error: 'Konnte Site-Daten nicht sammeln' };
            }

            const systemPrompt = `Du bist ein erfahrener WordPress-Administrator und DevOps-Experte. 
Analysiere die bereitgestellten Daten einer WordPress-Site und erstelle einen umfassenden Bericht.
Sei spezifisch, priorisiere nach Dringlichkeit und gib konkrete Handlungsanweisungen.
Antworte auf Deutsch in strukturierter Form.`;

            const d = siteData.data;
            const prompt = `
# WordPress Site Vollanalyse

## Site
- Domain: ${d.domain} (${d.site_url})
- WordPress: ${d.wordpress_version || 'Unbekannt'}
- PHP: ${d.php_version || 'Unbekannt'}
- Health Score: ${d.health_score || 0}/100
- Security Score: ${d.security_score || 0}/100
- SSL: ${d.ssl_enabled ? 'Aktiv' : 'FEHLT'}

## Plugins
- Gesamt: ${d.plugins_total}, Aktiv: ${d.plugins_active}
- Updates ausstehend: ${d.plugins_updates}
${d.plugin_updates_detail?.length > 0 ? '- Update-Details:\n' + d.plugin_updates_detail.map(u => '  • ' + u).join('\n') : ''}

## Theme
- Aktiv: ${d.active_theme}

## Sicherheitsprobleme
${d.security_issues?.length > 0 ? d.security_issues.map(i => `- [${i.severity || 'info'}] ${i.title || i.message || i}`).join('\n') : '- Keine bekannten Probleme'}

## Performance
${d.performance ? `- Ladezeit: ${d.performance.load_time}ms\n- DB-Größe: ${Math.round((d.performance.db_size || 0) / 1024 / 1024)}MB\n- Cache-Rate: ${d.performance.cache_ratio || 0}%` : '- Keine Messdaten'}

## Inhalt
- Beiträge: ${d.posts_count}, Seiten: ${d.pages_count}, Kommentare: ${d.comments_count}, Nutzer: ${d.users_count}

---

Erstelle eine präzise Analyse auf Deutsch. Beziehe dich NUR auf die obigen echten Daten. Keine Spekulationen.

## 🚨 KRITISCH (Sofort handeln)
[Nur wenn wirklich kritische Probleme vorhanden — konkrete Lösungsschritte]

## ⚠️ WICHTIG (Diese Woche)
[Wichtige Aufgaben mit Begründung]

## 💡 EMPFEHLUNGEN
[Optimierungen und Best Practices]

## 🤖 AUTOMATISIERBAR
[Was kann WPMA.io automatisch erledigen? z.B. Plugin-Updates, Backup, Security-Scan]

## 📊 FAZIT
[2-3 Sätze Gesamtbewertung mit konkreten Top-3-Prioritäten]
`;

            const analysis = await this.analyze(prompt, systemPrompt, 2000);
            
            // Parse und speichere
            const parsedAnalysis = this.parseFullAnalysis(analysis);
            await this.storeAIInsight(siteId, 'full_analysis', {
                raw: analysis,
                parsed: parsedAnalysis,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                data: {
                    analysis: parsedAnalysis,
                    raw: analysis,
                    generatedAt: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error('Full site analysis error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Auto-Update Analyse - prüft ob Updates sicher durchgeführt werden können
     */
    async analyzeUpdateSafety(siteId, updateType, updates) {
        try {
            const systemPrompt = `Du bist ein WordPress-Update-Experte. Analysiere die vorgeschlagenen Updates 
und bewerte das Risiko. Berücksichtige Kompatibilität, bekannte Probleme und Best Practices.`;

            const prompt = `
# Update-Sicherheitsanalyse

## Update-Typ: ${updateType}

## Geplante Updates:
${JSON.stringify(updates, null, 2)}

## Fragen:
1. Wie hoch ist das Risiko dieser Updates? (niedrig/mittel/hoch)
2. Gibt es bekannte Kompatibilitätsprobleme?
3. Sollte ein Backup vor dem Update erstellt werden?
4. Empfehlung: Automatisch durchführen oder manuell prüfen?

Antworte im JSON-Format:
{
    "risk_level": "low|medium|high",
    "can_auto_update": true/false,
    "requires_backup": true/false,
    "compatibility_issues": [],
    "recommendation": "...",
    "steps": []
}
`;

            const analysis = await this.analyze(prompt, systemPrompt, 800);
            
            // Versuche JSON zu parsen
            let result;
            try {
                const jsonMatch = analysis.match(/\{[\s\S]*\}/);
                result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
            } catch (e) {
                result = {
                    risk_level: 'medium',
                    can_auto_update: false,
                    requires_backup: true,
                    recommendation: analysis
                };
            }

            return { success: true, data: result };
        } catch (error) {
            console.error('Update safety analysis error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Proaktive Problemerkennung - analysiert Trends und warnt vor Problemen
     */
    async detectProactiveIssues(siteId) {
        try {
            // Hole historische Daten
            const historyData = await this.getHistoricalData(siteId);
            
            const systemPrompt = `Du bist ein proaktiver Site-Monitor. Analysiere historische Daten 
und identifiziere Trends die auf zukünftige Probleme hindeuten könnten.`;

            const prompt = `
# Proaktive Analyse - Trends erkennen

## Historische Daten (letzte 7 Tage):
${JSON.stringify(historyData, null, 2)}

## Analysiere:
1. Performance-Trends (wird die Site langsamer?)
2. Sicherheits-Trends (mehr fehlgeschlagene Logins?)
3. Ressourcen-Trends (wächst die Datenbank zu schnell?)
4. Uptime-Muster (gibt es wiederkehrende Ausfälle?)

## Output-Format:
Für jedes erkannte Problem:
- Problem: [Beschreibung]
- Trend: [steigend/fallend/stabil]
- Prognose: [was passiert wenn nichts getan wird]
- Empfohlene Aktion: [konkrete Maßnahme]
- Dringlichkeit: [1-10]
`;

            const analysis = await this.analyze(prompt, systemPrompt, 1200);
            
            await this.storeAIInsight(siteId, 'proactive', {
                analysis,
                timestamp: new Date().toISOString()
            });

            return { success: true, data: { analysis } };
        } catch (error) {
            console.error('Proactive detection error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Analysiert einen Fehler und gibt strukturierte Diagnose zurück.
     * Wird von selfHealingService verwendet.
     */
    async analyzeError(siteId, error, context = {}, logs = []) {
        try {
            const systemPrompt = `Du bist ein WordPress-Diagnose-Experte. Analysiere Fehler und gib strukturierte Diagnosen zurück.`;
            const prompt = `
# WordPress-Fehler analysieren

Site-ID: ${siteId}
Fehler: ${error}
Kontext: ${JSON.stringify(context, null, 2)}
Logs: ${Array.isArray(logs) ? logs.slice(-10).join('\n') : String(logs)}

Analysiere den Fehler und antworte als JSON:
{
    "error_type": "plugin|theme|core|database|server|unknown",
    "severity": "critical|high|medium|low",
    "confidence": 0.0-1.0,
    "explanation": "...",
    "root_cause": "...",
    "recommended_fixes": ["..."]
}`;

            const response = await this.analyze(prompt, systemPrompt, 800);

            let data;
            try {
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                data = jsonMatch ? JSON.parse(jsonMatch[0]) : {
                    error_type: 'unknown', severity: 'medium', confidence: 0.5,
                    explanation: response, root_cause: error, recommended_fixes: []
                };
            } catch (e) {
                data = {
                    error_type: 'unknown', severity: 'medium', confidence: 0.5,
                    explanation: response, root_cause: error, recommended_fixes: []
                };
            }

            return { success: true, data };
        } catch (error) {
            console.error('analyzeError failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Automatische Problemlösung - generiert und führt Lösungen aus
     */
    async generateAutoFix(siteId, problem) {
        try {
            const systemPrompt = `Du bist ein WordPress-Automatisierungsexperte. 
Generiere sichere, automatisierbare Lösungen für WordPress-Probleme.
Gib nur Lösungen die sicher automatisch ausgeführt werden können.`;

            const prompt = `
# Problem zu lösen:
${JSON.stringify(problem, null, 2)}

# Generiere eine automatische Lösung:
1. Was genau muss getan werden?
2. Welche Risiken gibt es?
3. Welche Backup-Maßnahmen sind nötig?
4. Generiere ausführbaren Code (wenn möglich PHP/WP-CLI)

Output als JSON:
{
    "can_auto_fix": true/false,
    "risk_level": "low|medium|high",
    "description": "...",
    "backup_required": true/false,
    "steps": [
        {"action": "...", "code": "...", "verify": "..."}
    ],
    "rollback_plan": "..."
}
`;

            const analysis = await this.analyze(prompt, systemPrompt, 1000);
            
            let result;
            try {
                const jsonMatch = analysis.match(/\{[\s\S]*\}/);
                result = jsonMatch ? JSON.parse(jsonMatch[0]) : { can_auto_fix: false, description: analysis };
            } catch (e) {
                result = { can_auto_fix: false, description: analysis };
            }

            return { success: true, data: result };
        } catch (error) {
            console.error('Auto-fix generation error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Universal Chat Assistant - funktioniert mit oder ohne siteId
     */
    async chatWithAssistant({ userId, siteId, message, conversationHistory = [] }) {
        try {
            let siteContext = '';
            if (siteId) {
                const siteData = await this.collectSiteData(siteId);
                siteContext = `
Site-Kontext:
- Domain: ${siteData.data?.domain || 'Unbekannt'}
- WordPress: ${siteData.data?.wordpress_version || 'Unbekannt'}
- Status: ${siteData.data?.status || 'Unbekannt'}
- Health Score: ${siteData.data?.health_score || 'N/A'}`;
            } else {
                siteContext = 'Kontext: Allgemeine Dashboard-Übersicht';
            }

            const systemPrompt = `Du bist ein hilfreicher KI-Assistent für WPMA.io, eine WordPress-Management-Plattform.
Du hilfst Benutzern bei:
- WordPress-Site-Verwaltung
- Sicherheits- und Performance-Analysen
- Backup- und Update-Management
- Troubleshooting und Empfehlungen

${siteContext}

Antworte immer auf Deutsch, freundlich und präzise. Wenn du eine Aktion vorschlägst, erkläre warum.`;

            const messages = [
                ...conversationHistory.slice(-5).map(m => ({
                    role: m.role,
                    content: m.content
                })),
                { role: 'user', content: message }
            ];

            let response;
            let suggestions = [];

            if (this.preferredModel === 'claude' && this.anthropic) {
                const result = await this.anthropic.messages.create({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 800,
                    system: systemPrompt,
                    messages: messages
                });
                response = result.content[0].text;
            } else if (this.openai) {
                const result = await this.openai.chat.completions.create({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...messages
                    ],
                    max_tokens: 800,
                    temperature: 0.7
                });
                response = result.choices[0].message.content;
            } else {
                response = this.generateSmartFallbackResponse(message, siteId);
                suggestions = this.getContextualSuggestions(message);
            }

            if (!suggestions.length) {
                suggestions = this.getContextualSuggestions(message);
            }

            return {
                success: true,
                response,
                suggestions,
                timestamp: new Date()
            };
        } catch (error) {
            console.error('Chat with assistant error:', error);
            return {
                success: true,
                response: this.generateSmartFallbackResponse(message, siteId),
                suggestions: this.getContextualSuggestions(message),
                timestamp: new Date()
            };
        }
    }

    generateSmartFallbackResponse(message, siteId) {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('backup')) {
            return 'Backups sind essentiell für deine WordPress-Sites. Ich kann dir helfen, automatische Backups einzurichten oder bestehende zu verwalten. Möchtest du ein Backup erstellen?';
        }
        if (lowerMessage.includes('update') || lowerMessage.includes('aktualisier')) {
            return 'Updates sind wichtig für Sicherheit und Performance. Ich empfehle, vor jedem Update ein Backup zu erstellen. Welche Sites möchtest du aktualisieren?';
        }
        if (lowerMessage.includes('sicherheit') || lowerMessage.includes('security')) {
            return 'Sicherheit ist entscheidend. Ich kann für dich Security-Scans durchführen und Schwachstellen identifizieren. Soll ich einen Scan starten?';
        }
        if (lowerMessage.includes('performance') || lowerMessage.includes('langsam')) {
            return 'Performance-Probleme können viele Ursachen haben. Ich analysiere gerne deine Site-Performance und gebe konkrete Optimierungs-Tipps. Welche Site möchtest du optimieren?';
        }
        if (lowerMessage.includes('kritisch') || lowerMessage.includes('problem')) {
            return 'Ich verstehe, dass du nach kritischen Problemen suchst. Lass mich deine Sites analysieren und priorisierte Handlungsempfehlungen geben.';
        }
        
        return `Ich verstehe deine Anfrage zu "${message}". Als KI-Assistent kann ich dir bei WordPress-Management helfen. Möchtest du mehr über deine Sites erfahren oder eine spezifische Aktion durchführen?`;
    }

    getContextualSuggestions(message) {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('backup')) {
            return [
                'Backup jetzt erstellen',
                'Alle Backups anzeigen',
                'Automatische Backups einrichten',
                'Backup wiederherstellen'
            ];
        }
        if (lowerMessage.includes('update')) {
            return [
                'Alle verfügbaren Updates zeigen',
                'Kritische Updates installieren',
                'Update-Zeitplan erstellen',
                'WordPress Core aktualisieren'
            ];
        }
        
        return [
            'Zeige mir kritische Sites',
            'Backup alle Sites erstellen',
            'Welche Updates stehen an?',
            'Performance-Probleme finden'
        ];
    }

    // ==========================================
    // HILFSFUNKTIONEN
    // ==========================================

    async collectSiteData(siteId) {
        try {
            const [siteResult, pluginsResult, themesResult, statsResult, securityResult, performanceResult] = await Promise.all([
                query(`SELECT * FROM sites WHERE id = $1`, [siteId]),
                query(`SELECT name, slug, version, active, update_available, new_version, is_premium FROM site_plugins WHERE site_id = $1`, [siteId]),
                query(`SELECT name, slug, version, active, update_available FROM site_themes WHERE site_id = $1`, [siteId]),
                query(`SELECT * FROM site_stats WHERE site_id = $1 LIMIT 1`, [siteId]),
                query(`SELECT scan_results, threats_found, created_at FROM security_scans WHERE site_id = $1 ORDER BY created_at DESC LIMIT 1`, [siteId]),
                query(`SELECT page_load_time, database_size, cache_hit_ratio, created_at FROM performance_metrics WHERE site_id = $1 ORDER BY created_at DESC LIMIT 1`, [siteId]),
            ]);

            if (siteResult.rows.length === 0) {
                return { success: false, error: 'Site nicht gefunden' };
            }

            const site = siteResult.rows[0];
            const plugins = pluginsResult.rows;
            const themes = themesResult.rows;
            const stats = statsResult.rows[0] || {};
            const security = securityResult.rows[0] || null;
            const performance = performanceResult.rows[0] || null;

            const pluginUpdates = plugins.filter(p => p.update_available);
            const activePlugins = plugins.filter(p => p.active);
            const activeTheme = themes.find(t => t.active);

            let securityIssues = [];
            try {
                const raw = typeof site.security_issues === 'string'
                    ? JSON.parse(site.security_issues)
                    : (site.security_issues || []);
                securityIssues = raw;
            } catch { securityIssues = []; }

            return {
                success: true,
                data: {
                    domain: site.domain,
                    site_url: site.site_url,
                    wordpress_version: site.wordpress_version,
                    php_version: site.php_version,
                    status: site.status,
                    health_score: site.health_score,
                    security_score: site.security_score,
                    ssl_enabled: site.site_url?.startsWith('https://') || site.ssl_enabled,
                    security_issues: securityIssues,
                    last_check: site.last_check,
                    plugins_total: plugins.length,
                    plugins_active: activePlugins.length,
                    plugins_updates: pluginUpdates.length,
                    plugin_updates_detail: pluginUpdates.map(p => `${p.name} (${p.version} → ${p.new_version || 'neu'})`),
                    active_theme: activeTheme?.name || 'Unbekannt',
                    posts_count: stats.posts_count || 0,
                    pages_count: stats.pages_count || 0,
                    comments_count: stats.comments_count || 0,
                    users_count: stats.users_count || 0,
                    security: security ? { threats: security.threats_found, results: security.scan_results } : null,
                    performance: performance ? {
                        load_time: performance.page_load_time,
                        db_size: performance.database_size,
                        cache_ratio: performance.cache_hit_ratio
                    } : null,
                }
            };
        } catch (error) {
            console.error('Error collecting site data:', error);
            return { success: false, error: error.message };
        }
    }

    async getHistoricalData(siteId) {
        try {
            const [performance, security, uptime] = await Promise.all([
                query(`SELECT * FROM performance_metrics WHERE site_id = $1 
                       AND created_at > NOW() - INTERVAL '7 days' ORDER BY created_at`, [siteId]),
                query(`SELECT * FROM security_scans WHERE site_id = $1 
                       AND created_at > NOW() - INTERVAL '7 days' ORDER BY created_at`, [siteId]),
                query(`SELECT * FROM uptime_checks WHERE site_id = $1 
                       AND created_at > NOW() - INTERVAL '7 days' ORDER BY created_at`, [siteId])
            ]);

            return {
                performance: performance.rows,
                security: security.rows,
                uptime: uptime.rows
            };
        } catch (error) {
            console.error('Error getting historical data:', error);
            return { performance: [], security: [], uptime: [] };
        }
    }

    parseFullAnalysis(analysis) {
        const sections = {
            critical: [],
            important: [],
            recommendations: [],
            auto_actions: [],
            summary: { score: 0, priorities: [] }
        };

        const lines = analysis.split('\n');
        let currentSection = null;

        for (const line of lines) {
            const lowerLine = line.toLowerCase();
            if (lowerLine.includes('kritisch') || lowerLine.includes('🚨')) {
                currentSection = 'critical';
            } else if (lowerLine.includes('wichtig') || lowerLine.includes('⚠️')) {
                currentSection = 'important';
            } else if (lowerLine.includes('empfehlungen') || lowerLine.includes('💡')) {
                currentSection = 'recommendations';
            } else if (lowerLine.includes('automatische') || lowerLine.includes('🤖')) {
                currentSection = 'auto_actions';
            } else if (lowerLine.includes('zusammenfassung') || lowerLine.includes('📊')) {
                currentSection = 'summary';
            } else if (line.trim().startsWith('-') && currentSection && currentSection !== 'summary') {
                sections[currentSection].push(line.trim().substring(1).trim());
            } else if (currentSection === 'summary') {
                const scoreMatch = line.match(/(\d+)\s*[\/von]*\s*100/);
                if (scoreMatch) {
                    sections.summary.score = parseInt(scoreMatch[1]);
                }
                if (line.trim().startsWith('-') || line.match(/^\d+\./)) {
                    sections.summary.priorities.push(line.trim().replace(/^[\d\.\-\*]+\s*/, ''));
                }
            }
        }

        return sections;
    }
}

module.exports = new AIService(); 