const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { query } = require('../config/database');
const { logger } = require('../utils/logger');

// ============================================================
// Publisher-Adapter-System
// Jeder Adapter implementiert publish(project, post, media)
// ============================================================

class WordPressAdapter {
    // Publiziert über die WP REST API mit Application Password
    async publish(project, post, media) {
        const { wp_url, wp_user, wp_app_password } = project.config || {};

        if (!wp_url || !wp_user || !wp_app_password) {
            throw new Error('WordPress-Konfiguration unvollständig (wp_url, wp_user, wp_app_password erforderlich)');
        }

        const apiBase = wp_url.replace(/\/$/, '') + '/wp-json/wp/v2';
        const credentials = Buffer.from(`${wp_user}:${wp_app_password}`).toString('base64');

        // Featured Image zuerst hochladen wenn vorhanden
        let featuredMediaId = null;
        const featuredMedia = media?.find(m => m.is_featured);
        if (featuredMedia) {
            try {
                featuredMediaId = await this._uploadMediaFromUrl(
                    apiBase, credentials, featuredMedia.url, featuredMedia.alt_text
                );
            } catch (err) {
                logger.warn('WP featured image upload failed, continuing without it', { error: err.message });
            }
        }

        const payload = {
            title: post.title,
            content: this._markdownToHtml(post.content),
            excerpt: post.excerpt || '',
            status: 'publish',
            ...(featuredMediaId && { featured_media: featuredMediaId }),
        };

        const response = await this._wpRequest('POST', `${apiBase}/posts`, credentials, payload);

        return {
            remote_id: String(response.id),
            remote_url: response.link,
        };
    }

    async _wpRequest(method, url, credentials, body) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const isHttps = urlObj.protocol === 'https:';
            const lib = isHttps ? https : http;

            const data = body ? JSON.stringify(body) : null;

            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method,
                headers: {
                    Authorization: `Basic ${credentials}`,
                    'Content-Type': 'application/json',
                    ...(data && { 'Content-Length': Buffer.byteLength(data) }),
                },
                timeout: 30000,
            };

            const req = lib.request(options, (res) => {
                let resp = '';
                res.on('data', c => { resp += c; });
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try { resolve(JSON.parse(resp)); } catch { resolve(resp); }
                    } else {
                        try {
                            const err = JSON.parse(resp);
                            reject(new Error(err.message || `WP API ${res.statusCode}`));
                        } catch {
                            reject(new Error(`WP API ${res.statusCode}: ${resp.slice(0, 200)}`));
                        }
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('WP API timeout')); });
            if (data) req.write(data);
            req.end();
        });
    }

    async _uploadMediaFromUrl(apiBase, credentials, imageUrl, altText) {
        // Bild von Pexels herunterladen und zu WP hochladen
        const imageData = await this._downloadImage(imageUrl);
        const filename = `wpma-content-${Date.now()}.jpg`;

        return new Promise((resolve, reject) => {
            const urlObj = new URL(`${apiBase}/media`);
            const isHttps = urlObj.protocol === 'https:';
            const lib = isHttps ? https : http;

            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname,
                method: 'POST',
                headers: {
                    Authorization: `Basic ${credentials}`,
                    'Content-Disposition': `attachment; filename="${filename}"`,
                    'Content-Type': 'image/jpeg',
                    'Content-Length': imageData.length,
                },
                timeout: 60000,
            };

            const req = lib.request(options, (res) => {
                let resp = '';
                res.on('data', c => { resp += c; });
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            const parsed = JSON.parse(resp);
                            // Set alt text
                            if (altText && parsed.id) {
                                this._wpRequest('POST', `${apiBase}/media/${parsed.id}`, credentials, {
                                    alt_text: altText,
                                }).catch(() => {}); // Non-blocking
                            }
                            resolve(parsed.id);
                        } catch { resolve(null); }
                    } else {
                        reject(new Error(`Media upload ${res.statusCode}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Media upload timeout')); });
            req.write(imageData);
            req.end();
        });
    }

    _downloadImage(url) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const lib = urlObj.protocol === 'https:' ? https : http;

            lib.get(url, { timeout: 30000 }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return resolve(this._downloadImage(res.headers.location));
                }
                const chunks = [];
                res.on('data', c => chunks.push(c));
                res.on('end', () => resolve(Buffer.concat(chunks)));
                res.on('error', reject);
            }).on('error', reject).on('timeout', () => reject(new Error('Image download timeout')));
        });
    }

    // Minimale Markdown → HTML Konvertierung
    _markdownToHtml(markdown) {
        if (!markdown) return '';
        return markdown
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(.+)$/gm, (line) => {
                if (line.startsWith('<h') || line.startsWith('<p') || line.startsWith('</p')) return line;
                return line;
            })
            .replace(/^<\/p><p>/, '')
            + '';
    }
}

class StaticHtmlAdapter {
    // Sendet signierten Request an wpma-agent auf dem Ziel-Server
    async publish(project, post, media) {
        const { agent_url } = project.config || {};
        if (!agent_url) {
            throw new Error('static_html Konfiguration unvollständig (agent_url erforderlich)');
        }
        if (!project.agent_token) {
            throw new Error('Kein Agent-Token konfiguriert. Bitte Token neu generieren.');
        }

        const payload = {
            action: 'publish_content',
            post: {
                title: post.title,
                content: post.content,
                excerpt: post.excerpt,
                keywords: post.keywords,
                language: post.language,
            },
            media: media || [],
            timestamp: Math.floor(Date.now() / 1000),
            nonce: crypto.randomBytes(16).toString('hex'),
        };

        const body = JSON.stringify(payload);
        const signature = crypto
            .createHmac('sha256', project.agent_token)
            .update(body)
            .digest('hex');

        const response = await this._sendRequest(agent_url, body, signature);

        return {
            remote_id: response.file_path || response.id || null,
            remote_url: response.url || null,
        };
    }

    _sendRequest(agentUrl, body, signature) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(agentUrl);
            const isHttps = urlObj.protocol === 'https:';
            const lib = isHttps ? https : http;

            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                    'X-WPMA-Signature': `sha256=${signature}`,
                    'X-WPMA-Agent': 'wpma.io/1.0',
                },
                timeout: 30000,
            };

            const req = lib.request(options, (res) => {
                let resp = '';
                res.on('data', c => { resp += c; });
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try { resolve(JSON.parse(resp)); } catch { resolve({ ok: true }); }
                    } else {
                        reject(new Error(`Agent response ${res.statusCode}: ${resp.slice(0, 200)}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Agent request timeout')); });
            req.write(body);
            req.end();
        });
    }
}

class WebhookAdapter {
    // Sendet HMAC-signierten Payload an beliebige Webhook-URL
    async publish(project, post, media) {
        const { webhook_url } = project.config || {};
        if (!webhook_url) {
            throw new Error('Webhook-Konfiguration unvollständig (webhook_url erforderlich)');
        }

        const payload = {
            event: 'content.publish',
            project: { id: project.id, name: project.name, type: project.type },
            post: {
                title: post.title,
                content: post.content,
                excerpt: post.excerpt,
                keywords: post.keywords,
                language: post.language,
            },
            media: (media || []).map(m => ({
                url: m.url,
                alt_text: m.alt_text,
                is_featured: m.is_featured,
            })),
            timestamp: new Date().toISOString(),
        };

        const body = JSON.stringify(payload);
        const signature = project.agent_token
            ? crypto.createHmac('sha256', project.agent_token).update(body).digest('hex')
            : null;

        const response = await this._sendRequest(webhook_url, body, signature);

        return {
            remote_id: response.id || response.post_id || null,
            remote_url: response.url || null,
        };
    }

    _sendRequest(url, body, signature) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const isHttps = urlObj.protocol === 'https:';
            const lib = isHttps ? https : http;

            const headers = {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'User-Agent': 'wpma.io-webhook/1.0',
            };
            if (signature) {
                headers['X-WPMA-Signature'] = `sha256=${signature}`;
            }

            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: 'POST',
                headers,
                timeout: 15000,
            };

            const req = lib.request(options, (res) => {
                let resp = '';
                res.on('data', c => { resp += c; });
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try { resolve(JSON.parse(resp)); } catch { resolve({ ok: true }); }
                    } else {
                        reject(new Error(`Webhook ${res.statusCode}: ${resp.slice(0, 200)}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Webhook timeout')); });
            req.write(body);
            req.end();
        });
    }
}

// ============================================================
// PublisherService — orchestriert alle Adapter
// ============================================================

class PublisherService {
    constructor() {
        this.adapters = {
            wordpress: new WordPressAdapter(),
            static_html: new StaticHtmlAdapter(),
            webflow: new WebhookAdapter(),    // Webflow nutzt Custom Webhook
            custom: new WebhookAdapter(),
        };
    }

    getAdapter(type) {
        const adapter = this.adapters[type];
        if (!adapter) throw new Error(`Unbekannter Projekt-Typ: ${type}`);
        return adapter;
    }

    // Hauptmethode: publish post to project
    async publish(project, post, media = []) {
        const jobResult = await query(
            `INSERT INTO publish_jobs (post_id, project_id, user_id, status, adapter_type, started_at, request_payload)
             VALUES ($1, $2, $3, 'running', $4, NOW(), $5)
             RETURNING id`,
            [post.id, project.id, post.user_id, project.type, JSON.stringify({ post_id: post.id, project_id: project.id })]
        );
        const jobId = jobResult.rows[0].id;

        try {
            const adapter = this.getAdapter(project.type);
            const result = await adapter.publish(project, post, media);

            // Job als erfolgreich markieren
            await query(
                `UPDATE publish_jobs
                 SET status = 'success', completed_at = NOW(), response_payload = $1
                 WHERE id = $2`,
                [JSON.stringify(result), jobId]
            );

            // Post-Status auf published setzen
            await query(
                `UPDATE content_posts
                 SET status = 'published', remote_id = $1, remote_url = $2, published_at = NOW(), updated_at = NOW()
                 WHERE id = $3`,
                [result.remote_id, result.remote_url, post.id]
            );

            logger.info('Content published', { postId: post.id, projectType: project.type, jobId });

            return { success: true, data: result, jobId };
        } catch (error) {
            // Job als fehlgeschlagen markieren
            await query(
                `UPDATE publish_jobs
                 SET status = 'failed', completed_at = NOW(), error_message = $1
                 WHERE id = $2`,
                [error.message, jobId]
            );

            // Post-Status zurücksetzen
            await query(
                'UPDATE content_posts SET status = $1, updated_at = NOW() WHERE id = $2',
                ['failed', post.id]
            );

            logger.error('Publish failed', { postId: post.id, projectType: project.type, error: error.message });

            return { success: false, error: error.message, jobId };
        }
    }

    // Publish-Jobs eines Users auflisten
    async listJobs(userId, { postId, limit = 20 } = {}) {
        const conditions = ['pj.user_id = $1'];
        const values = [userId];
        let idx = 2;

        if (postId) { conditions.push(`pj.post_id = $${idx++}`); values.push(postId); }
        values.push(limit);

        const result = await query(
            `SELECT pj.*, cp.title AS post_title, pr.name AS project_name
             FROM publish_jobs pj
             LEFT JOIN content_posts cp ON cp.id = pj.post_id
             LEFT JOIN content_projects pr ON pr.id = pj.project_id
             WHERE ${conditions.join(' AND ')}
             ORDER BY pj.created_at DESC
             LIMIT $${idx}`,
            values
        );

        return result.rows;
    }
}

module.exports = new PublisherService();
