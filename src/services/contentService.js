const { chatJSON, getStatus } = require('./llmService');
const { query } = require('../config/database');
const { logger } = require('../utils/logger');

class ContentService {
    constructor() {
        const status = getStatus();
        this.isConfigured = status.groq || status.anthropic || status.openrouter;
        if (!this.isConfigured) {
            logger.warn('ContentService: Kein LLM-Provider konfiguriert (GROQ_API_KEY, ANTHROPIC_API_KEY oder OPENROUTER_API_KEY)');
        }
    }

    // Content generieren (Groq → Anthropic → OpenRouter)
    async generateContent({ topic, keywords = [], language = 'de', tone = 'professional', length = 'medium', additionalInstructions = '' }) {
        if (!this.isConfigured) {
            return { success: false, error: 'Kein LLM-Provider konfiguriert' };
        }

        const wordTargets = { short: 300, medium: 600, long: 1200 };
        const wordCount = wordTargets[length] || 600;

        const keywordList = keywords.length > 0
            ? `Keywords (natürlich einbauen): ${keywords.join(', ')}`
            : '';

        const systemPrompt = `Du bist ein professioneller Content-Autor für Websites und Blogs.
Du schreibst SEO-optimierten, authentischen Content der Leser wirklich anspricht.
Deine Texte sind klar strukturiert, gut lesbar und haben echten Mehrwert.
Verwende Überschriften (##, ###) um den Text zu gliedern.
Schreibe IMMER auf ${language === 'de' ? 'Deutsch' : language === 'en' ? 'Englisch' : language}.`;

        const userPrompt = `Schreibe einen hochwertigen Blog-Artikel / Website-Content über:

Thema: ${topic}
${keywordList}
Ton: ${tone === 'professional' ? 'Professionell und seriös' : tone === 'casual' ? 'Locker und freundlich' : tone === 'expert' ? 'Fachlich und detailliert' : 'Professionell'}
Länge: ca. ${wordCount} Wörter
${additionalInstructions ? `Zusätzliche Hinweise: ${additionalInstructions}` : ''}

Format:
1. Einen packenden Titel (als # Heading)
2. Eine kurze Einleitung (2-3 Sätze)
3. Hauptteil mit Unterabschnitten
4. Fazit/Call-to-Action

Antworte im folgenden JSON-Format:
{
  "title": "...",
  "excerpt": "...",
  "content": "... (Markdown)"
}`;

        try {
            let parsed;
            try {
                parsed = await chatJSON({ system: systemPrompt, prompt: userPrompt, model: 'smart', maxTokens: 4096 });
            } catch {
                return { success: false, error: 'Content-Generierung fehlgeschlagen' };
            }

            return {
                success: true,
                data: {
                    title: parsed.title || topic,
                    excerpt: parsed.excerpt || '',
                    content: parsed.content || '',
                    keywords,
                    language,
                    meta: {
                        model: 'claude-sonnet-4-6',
                        tokens_used: parsed.tokens_used ?? null,
                        generated_at: new Date().toISOString(),
                    },
                },
            };
        } catch (error) {
            logger.error('ContentService generate error', { topic, error: error.message });
            return { success: false, error: error.message };
        }
    }

    // Post in DB speichern
    async savePost({ projectId, userId, title, content, excerpt, keywords, language, meta }) {
        const result = await query(
            `INSERT INTO content_posts
             (project_id, user_id, title, content, excerpt, keywords, language, meta)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [projectId, userId, title, content, excerpt || '', keywords || [], language || 'de', JSON.stringify(meta || {})]
        );
        return result.rows[0];
    }

    // Post updaten
    async updatePost(postId, userId, { title, content, excerpt, keywords, status }) {
        const fields = [];
        const values = [];
        let idx = 1;

        if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title); }
        if (content !== undefined) { fields.push(`content = $${idx++}`); values.push(content); }
        if (excerpt !== undefined) { fields.push(`excerpt = $${idx++}`); values.push(excerpt); }
        if (keywords !== undefined) { fields.push(`keywords = $${idx++}`); values.push(keywords); }
        if (status !== undefined) { fields.push(`status = $${idx++}`); values.push(status); }

        fields.push(`updated_at = NOW()`);
        values.push(postId, userId);

        const result = await query(
            `UPDATE content_posts SET ${fields.join(', ')}
             WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`,
            values
        );
        return result.rows[0];
    }

    // Post abrufen
    async getPost(postId, userId) {
        const result = await query(
            `SELECT cp.*,
                    json_agg(cm.*) FILTER (WHERE cm.id IS NOT NULL) AS media
             FROM content_posts cp
             LEFT JOIN content_media cm ON cm.post_id = cp.id
             WHERE cp.id = $1 AND cp.user_id = $2
             GROUP BY cp.id`,
            [postId, userId]
        );
        return result.rows[0] || null;
    }

    // Posts eines Users auflisten
    async listPosts(userId, { projectId, status, page = 1, limit = 20 } = {}) {
        const conditions = ['cp.user_id = $1'];
        const values = [userId];
        let idx = 2;

        if (projectId) { conditions.push(`cp.project_id = $${idx++}`); values.push(projectId); }
        if (status) { conditions.push(`cp.status = $${idx++}`); values.push(status); }

        const offset = (page - 1) * limit;
        values.push(limit, offset);

        const result = await query(
            `SELECT cp.*, pr.name AS project_name, pr.type AS project_type,
                    (SELECT cm.thumbnail_url FROM content_media cm WHERE cm.post_id = cp.id AND cm.is_featured = TRUE LIMIT 1) AS featured_image
             FROM content_posts cp
             LEFT JOIN content_projects pr ON pr.id = cp.project_id
             WHERE ${conditions.join(' AND ')}
             ORDER BY cp.created_at DESC
             LIMIT $${idx} OFFSET $${idx + 1}`,
            values
        );

        const countResult = await query(
            `SELECT COUNT(*) FROM content_posts cp WHERE ${conditions.slice(0, -0).join(' AND ')}`,
            values.slice(0, -2)
        );

        return {
            posts: result.rows,
            total: parseInt(countResult.rows[0]?.count || 0),
            page,
            limit,
        };
    }

    // Post löschen
    async deletePost(postId, userId) {
        const result = await query(
            'DELETE FROM content_posts WHERE id = $1 AND user_id = $2 RETURNING id',
            [postId, userId]
        );
        return result.rows.length > 0;
    }

    // Media an Post anhängen
    async attachMedia(postId, userId, mediaItems) {
        // Sicherstellen dass Post dem User gehört
        const postCheck = await query(
            'SELECT id FROM content_posts WHERE id = $1 AND user_id = $2',
            [postId, userId]
        );
        if (!postCheck.rows.length) return null;

        const inserted = [];
        for (const item of mediaItems) {
            const res = await query(
                `INSERT INTO content_media
                 (post_id, pexels_id, url, thumbnail_url, alt_text, photographer, photographer_url, width, height, is_featured)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 ON CONFLICT DO NOTHING RETURNING *`,
                [
                    postId, item.pexels_id, item.url, item.thumbnail_url,
                    item.alt_text || '', item.photographer, item.photographer_url,
                    item.width, item.height, item.is_featured || false,
                ]
            );
            if (res.rows[0]) inserted.push(res.rows[0]);
        }

        // post.updated_at aktualisieren
        await query('UPDATE content_posts SET updated_at = NOW() WHERE id = $1', [postId]);

        return inserted;
    }

    // Media eines Posts löschen
    async removeMedia(mediaId, userId) {
        const result = await query(
            `DELETE FROM content_media cm
             USING content_posts cp
             WHERE cm.id = $1 AND cm.post_id = cp.id AND cp.user_id = $2
             RETURNING cm.id`,
            [mediaId, userId]
        );
        return result.rows.length > 0;
    }
}

module.exports = new ContentService();
