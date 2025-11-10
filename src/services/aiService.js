const OpenAI = require('openai');
const { query } = require('../config/database');

class AIService {
    constructor() {
        const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || 'dummy-key';
        this.openai = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: apiKey,
        });
        this.isConfigured = Boolean(process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY);
    }

    async generateSecurityRecommendations(siteData) {
        try {
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
}

module.exports = new AIService(); 