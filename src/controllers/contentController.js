const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const contentService = require('../services/contentService');
const publisherService = require('../services/publisherService');
const pexelsService = require('../services/pexelsService');
const { logger } = require('../utils/logger');

function getUserId(req) {
    return req.user?.userId;
}

async function getProjectForUser(projectId, userId) {
    const result = await query(
        'SELECT * FROM content_projects WHERE id = $1 AND user_id = $2',
        [projectId, userId]
    );
    return result.rows[0] || null;
}

class ContentController {
    async listProjects(req, res) {
        try {
            const userId = getUserId(req);
            const result = await query(
                `SELECT cp.*,
                        s.site_name AS site_name, s.site_url AS site_url,
                        COUNT(DISTINCT po.id) AS post_count,
                        COUNT(DISTINCT po.id) FILTER (WHERE po.status = 'published') AS published_count
                 FROM content_projects cp
                 LEFT JOIN sites s ON s.id = cp.site_id
                 LEFT JOIN content_posts po ON po.project_id = cp.id
                 WHERE cp.user_id = $1
                 GROUP BY cp.id, s.site_name, s.site_url
                 ORDER BY cp.created_at DESC`,
                [userId]
            );

            const projects = result.rows.map(p => {
                const { agent_token_hash, agent_token, ...safe } = p;
                return { ...safe, has_agent_token: Boolean(agent_token_hash) };
            });

            res.json({ success: true, data: projects });
        } catch (error) {
            logger.error('GET /content/projects error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async createProject(req, res) {
        try {
            const userId = getUserId(req);
            const { name, type = 'wordpress', url, site_id, config = {}, ip_whitelist = [] } = req.body;

            if (!name || !type) {
                return res.status(400).json({ success: false, error: 'name und type erforderlich' });
            }

            const validTypes = ['wordpress', 'static_html', 'webflow', 'custom'];
            if (!validTypes.includes(type)) {
                return res.status(400).json({ success: false, error: `Ungültiger Typ. Erlaubt: ${validTypes.join(', ')}` });
            }

            const plainToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = await bcrypt.hash(plainToken, 12);

            const result = await query(
                `INSERT INTO content_projects
                 (user_id, site_id, name, type, url, config, agent_token_hash, ip_whitelist)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING *`,
                [userId, site_id || null, name, type, url || null, JSON.stringify(config), tokenHash, JSON.stringify(ip_whitelist)]
            );

            const project = result.rows[0];
            const { agent_token_hash, agent_token, ...safeProject } = project;

            res.status(201).json({
                success: true,
                data: {
                    ...safeProject,
                    agent_token: plainToken,
                    has_agent_token: true,
                },
                message: 'Projekt erstellt. Speichere den Agent-Token — er wird nur einmal angezeigt!',
            });
        } catch (error) {
            logger.error('POST /content/projects error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getProject(req, res) {
        try {
            const userId = getUserId(req);
            const project = await getProjectForUser(req.params.id, userId);

            if (!project) {
                return res.status(404).json({ success: false, error: 'Projekt nicht gefunden' });
            }

            const { agent_token_hash, agent_token, ...safe } = project;
            res.json({ success: true, data: { ...safe, has_agent_token: Boolean(agent_token_hash) } });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async updateProject(req, res) {
        try {
            const userId = getUserId(req);
            const project = await getProjectForUser(req.params.id, userId);

            if (!project) {
                return res.status(404).json({ success: false, error: 'Projekt nicht gefunden' });
            }

            const { name, url, config, ip_whitelist, active } = req.body;
            const fields = [];
            const values = [];
            let idx = 1;

            if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
            if (url !== undefined) { fields.push(`url = $${idx++}`); values.push(url); }
            if (config !== undefined) { fields.push(`config = $${idx++}`); values.push(JSON.stringify(config)); }
            if (ip_whitelist !== undefined) { fields.push(`ip_whitelist = $${idx++}`); values.push(JSON.stringify(ip_whitelist)); }
            if (active !== undefined) { fields.push(`active = $${idx++}`); values.push(active); }
            fields.push(`updated_at = NOW()`);

            values.push(req.params.id, userId);

            const result = await query(
                `UPDATE content_projects SET ${fields.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`,
                values
            );

            const { agent_token_hash, agent_token: _t, ...safe } = result.rows[0];
            res.json({ success: true, data: { ...safe, has_agent_token: Boolean(agent_token_hash) } });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async rotateToken(req, res) {
        try {
            const userId = getUserId(req);
            const project = await getProjectForUser(req.params.id, userId);

            if (!project) {
                return res.status(404).json({ success: false, error: 'Projekt nicht gefunden' });
            }

            const plainToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = await bcrypt.hash(plainToken, 12);

            await query(
                'UPDATE content_projects SET agent_token_hash = $1, updated_at = NOW() WHERE id = $2',
                [tokenHash, project.id]
            );

            res.json({
                success: true,
                data: { agent_token: plainToken },
                message: 'Token rotiert. Speichere ihn — er wird nur einmal angezeigt!',
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async deleteProject(req, res) {
        try {
            const userId = getUserId(req);
            const result = await query(
                'DELETE FROM content_projects WHERE id = $1 AND user_id = $2 RETURNING id',
                [req.params.id, userId]
            );

            if (!result.rows.length) {
                return res.status(404).json({ success: false, error: 'Projekt nicht gefunden' });
            }

            res.json({ success: true, message: 'Projekt gelöscht' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async generateContent(req, res) {
        try {
            const userId = getUserId(req);
            const { topic, keywords, language, tone, length, project_id, additional_instructions, save = false } = req.body;

            if (!topic) {
                return res.status(400).json({ success: false, error: 'topic erforderlich' });
            }

            const result = await contentService.generateContent({
                topic,
                keywords: keywords || [],
                language: language || 'de',
                tone: tone || 'professional',
                length: length || 'medium',
                additionalInstructions: additional_instructions || '',
            });

            if (!result.success) {
                return res.status(500).json(result);
            }

            if (save && project_id) {
                const project = await getProjectForUser(project_id, userId);
                if (!project) {
                    return res.status(404).json({ success: false, error: 'Projekt nicht gefunden' });
                }

                const post = await contentService.savePost({
                    projectId: project_id,
                    userId,
                    ...result.data,
                });

                return res.json({ success: true, data: { ...result.data, post_id: post.id, post } });
            }

            res.json(result);
        } catch (error) {
            logger.error('POST /content/generate error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async listPosts(req, res) {
        try {
            const userId = getUserId(req);
            const { project_id, status, page = 1, limit = 20 } = req.query;

            const result = await contentService.listPosts(userId, {
                projectId: project_id ? parseInt(project_id) : null,
                status,
                page: parseInt(page),
                limit: Math.min(parseInt(limit), 100),
            });

            res.json({ success: true, data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async createPost(req, res) {
        try {
            const userId = getUserId(req);
            const { project_id, title, content, excerpt, keywords, language } = req.body;

            if (!project_id || !title || !content) {
                return res.status(400).json({ success: false, error: 'project_id, title und content erforderlich' });
            }

            const project = await getProjectForUser(project_id, userId);
            if (!project) {
                return res.status(404).json({ success: false, error: 'Projekt nicht gefunden' });
            }

            const post = await contentService.savePost({ projectId: project_id, userId, title, content, excerpt, keywords, language });
            res.status(201).json({ success: true, data: post });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getPost(req, res) {
        try {
            const userId = getUserId(req);
            const post = await contentService.getPost(req.params.id, userId);

            if (!post) {
                return res.status(404).json({ success: false, error: 'Post nicht gefunden' });
            }

            res.json({ success: true, data: post });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async updatePost(req, res) {
        try {
            const userId = getUserId(req);
            const post = await contentService.updatePost(req.params.id, userId, req.body);

            if (!post) {
                return res.status(404).json({ success: false, error: 'Post nicht gefunden' });
            }

            res.json({ success: true, data: post });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async deletePost(req, res) {
        try {
            const userId = getUserId(req);
            const deleted = await contentService.deletePost(req.params.id, userId);

            if (!deleted) {
                return res.status(404).json({ success: false, error: 'Post nicht gefunden' });
            }

            res.json({ success: true, message: 'Post gelöscht' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async searchMedia(req, res) {
        try {
            const { q, page = 1, per_page = 15, orientation } = req.query;

            if (!q) {
                return res.status(400).json({ success: false, error: 'Suchbegriff (q) erforderlich' });
            }

            const result = await pexelsService.searchPhotos(q, {
                page: parseInt(page),
                perPage: parseInt(per_page),
                orientation,
            });

            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getCuratedMedia(req, res) {
        try {
            const { page = 1, per_page = 15 } = req.query;
            const result = await pexelsService.getCuratedPhotos({ page: parseInt(page), perPage: parseInt(per_page) });
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async attachMedia(req, res) {
        try {
            const userId = getUserId(req);
            const { media } = req.body;

            if (!Array.isArray(media) || media.length === 0) {
                return res.status(400).json({ success: false, error: 'media Array erforderlich' });
            }

            const inserted = await contentService.attachMedia(req.params.id, userId, media);

            if (!inserted) {
                return res.status(404).json({ success: false, error: 'Post nicht gefunden' });
            }

            res.json({ success: true, data: inserted });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async removeMedia(req, res) {
        try {
            const userId = getUserId(req);
            const deleted = await contentService.removeMedia(req.params.mediaId, userId);

            if (!deleted) {
                return res.status(404).json({ success: false, error: 'Media nicht gefunden' });
            }

            res.json({ success: true, message: 'Media entfernt' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async publishPost(req, res) {
        try {
            const userId = getUserId(req);
            const { project_id } = req.body;

            if (!project_id) {
                return res.status(400).json({ success: false, error: 'project_id erforderlich' });
            }

            const post = await contentService.getPost(req.params.postId, userId);
            if (!post) {
                return res.status(404).json({ success: false, error: 'Post nicht gefunden' });
            }

            const project = await getProjectForUser(project_id, userId);
            if (!project) {
                return res.status(404).json({ success: false, error: 'Projekt nicht gefunden' });
            }

            if (!project.active) {
                return res.status(400).json({ success: false, error: 'Projekt ist deaktiviert' });
            }

            await query('UPDATE content_posts SET status = $1, updated_at = NOW() WHERE id = $2', ['publishing', post.id]);

            const publishProject = { ...project };
            if (['static_html', 'webflow', 'custom'].includes(project.type)) {
                const tokenFromConfig = project.config?.agent_token;
                if (tokenFromConfig) {
                    publishProject.agent_token = tokenFromConfig;
                }
            }

            const result = await publisherService.publish(publishProject, post, post.media || []);

            res.json(result);
        } catch (error) {
            logger.error('POST /content/publish error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async trackJobs(req, res) {
        try {
            const userId = getUserId(req);
            const { post_id, limit = 50 } = req.query;

            const jobs = await publisherService.listJobs(userId, {
                postId: post_id ? parseInt(post_id) : null,
                limit: Math.min(parseInt(limit), 200),
            });

            res.json({ success: true, data: jobs });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getStats(req, res) {
        try {
            const userId = getUserId(req);

            const [projects, posts, published, jobs] = await Promise.all([
                query('SELECT COUNT(*) FROM content_projects WHERE user_id = $1 AND active = TRUE', [userId]),
                query('SELECT COUNT(*) FROM content_posts WHERE user_id = $1', [userId]),
                query("SELECT COUNT(*) FROM content_posts WHERE user_id = $1 AND status = 'published'", [userId]),
                query("SELECT COUNT(*) FROM publish_jobs WHERE user_id = $1 AND status = 'success'", [userId]),
            ]);

            res.json({
                success: true,
                data: {
                    active_projects: parseInt(projects.rows[0].count),
                    total_posts: parseInt(posts.rows[0].count),
                    published_posts: parseInt(published.rows[0].count),
                    successful_publishes: parseInt(jobs.rows[0].count),
                },
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new ContentController();
