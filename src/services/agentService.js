'use strict';

/**
 * Autonomer KI-Agent Service
 *
 * Flow: detect → analyze (Claude) → plan actions → await approval → execute → report
 *
 * Supported categories: performance, security, uptime, plugin, core, woocommerce
 */

const { chatJSON } = require('./llmService');
const { query } = require('../config/database');
const axios = require('axios');

// ─── Severity mapping ───────────────────────────────────────────────────────

const SEVERITY_PRIORITY = { critical: 4, high: 3, medium: 2, low: 1 };

// ─── Detect issues from site health data ────────────────────────────────────

async function detectIssues(siteId) {
    const siteResult = await query(
        `SELECT s.*,
                (SELECT row_to_json(pm) FROM (
                    SELECT * FROM performance_metrics WHERE site_id = $1 ORDER BY measured_at DESC LIMIT 1
                ) pm) AS latest_perf,
                (SELECT row_to_json(ss) FROM (
                    SELECT * FROM security_scans WHERE site_id = $1 ORDER BY created_at DESC LIMIT 1
                ) ss) AS latest_security,
                (SELECT row_to_json(um) FROM (
                    SELECT * FROM uptime_monitors WHERE site_id = $1 LIMIT 1
                ) um) AS uptime
         FROM sites s WHERE s.id = $1 AND s.status = 'active'`,
        [siteId]
    );

    if (!siteResult.rows.length) return [];

    const site = siteResult.rows[0];
    const issues = [];

    // Check: Health Score
    if (site.health_score !== null && site.health_score < 60) {
        issues.push({
            category: 'performance',
            severity: site.health_score < 40 ? 'critical' : 'high',
            title: `Health Score kritisch: ${site.health_score}%`,
            context: { healthScore: site.health_score, site },
        });
    }

    // Check: Performance (load_time is stored in seconds)
    const perf = site.latest_perf;
    if (perf?.load_time > 5) {
        issues.push({
            category: 'performance',
            severity: perf.load_time > 10 ? 'critical' : 'high',
            title: `Ladezeit zu hoch: ${parseFloat(perf.load_time).toFixed(1)}s`,
            context: { perf },
        });
    }

    // Check: Security Score
    const sec = site.latest_security;
    if (sec?.security_score !== undefined && sec.security_score < 60) {
        issues.push({
            category: 'security',
            severity: sec.security_score < 40 ? 'critical' : 'high',
            title: `Security Score kritisch: ${sec.security_score}/100`,
            context: { sec },
        });
    }

    // Check: Updates pending
    const totalUpdates = (site.plugins_updates || 0) + (site.themes_updates || 0) + (site.core_update_available ? 1 : 0);
    if (totalUpdates > 0) {
        issues.push({
            category: 'plugin',
            severity: site.core_update_available ? 'high' : 'medium',
            title: `${totalUpdates} ausstehende Update${totalUpdates > 1 ? 's' : ''}`,
            context: {
                pluginsUpdates: site.plugins_updates,
                themesUpdates: site.themes_updates,
                coreUpdate: site.core_update_available,
            },
        });
    }

    return issues;
}

// ─── Create a new agent task ─────────────────────────────────────────────────

async function createTask(siteId, userId, issueData) {
    const { category, severity, title, context } = issueData;

    // Deduplicate: avoid creating the same task twice
    const existing = await query(
        `SELECT id FROM agent_tasks
         WHERE site_id = $1 AND title = $2 AND status NOT IN ('done','failed','rejected')
         LIMIT 1`,
        [siteId, title]
    );
    if (existing.rows.length) return existing.rows[0];

    const result = await query(
        `INSERT INTO agent_tasks (site_id, user_id, category, severity, title, description, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'detected')
         RETURNING *`,
        [siteId, userId, category, severity, title, JSON.stringify(context)]
    );
    const task = result.rows[0];

    // Immediately kick off analysis
    analyzeAndPlan(task.id, context).catch(err =>
        console.error(`[Agent] analyzeAndPlan failed for task ${task.id}:`, err.message)
    );

    return task;
}

// ─── Analyze with Claude and generate action plan ────────────────────────────

async function analyzeAndPlan(taskId, context) {
    await query(`UPDATE agent_tasks SET status = 'analyzing', updated_at = NOW() WHERE id = $1`, [taskId]);

    const taskResult = await query(`SELECT * FROM agent_tasks WHERE id = $1`, [taskId]);
    const task = taskResult.rows[0];
    if (!task) return;

    const siteResult = await query(`SELECT domain, wordpress_version, php_version FROM sites WHERE id = $1`, [task.site_id]);
    const site = siteResult.rows[0] || {};

    const systemPrompt = `Du bist der autonome KI-Agent von wpma.io. Du HANDELST eigenständig.
Deine Aufgabe: WordPress-Probleme analysieren und sofort beheben — ohne auf Genehmigung zu warten, wo immer es sicher ist.

Regeln für requires_approval:
- clear_cache: IMMER false
- notify: IMMER false
- fix_config: false wenn kein Datenverlustrisiko
- update_plugin/core: false bei Minor/Patch-Updates, true bei Major-Updates
- disable_plugin / rollback_plugin: IMMER true

Antworte NUR mit validem JSON (kein Markdown, keine Erklärung).`;

    const userPrompt = `
Site: ${site.domain} (WordPress ${site.wordpress_version || 'unbekannt'}, PHP ${site.php_version || 'unbekannt'})
Problem: [${task.severity.toUpperCase()}] ${task.title}
Kategorie: ${task.category}
Kontext: ${JSON.stringify(context, null, 2)}

Erstelle einen Aktionsplan. Führe sichere Aktionen sofort aus (requires_approval: false).
Antworte mit exakt diesem JSON:
{
  "root_cause": "...",
  "impact": "...",
  "risk_if_ignored": "...",
  "action_plan": [
    {
      "step": 1,
      "action_type": "update_plugin|rollback_plugin|clear_cache|disable_plugin|fix_config|notify",
      "label": "Kurze Beschreibung",
      "details": "Was genau passiert",
      "risk": "low|medium|high",
      "requires_approval": false,
      "payload": {}
    }
  ],
  "estimated_fix_time": "2 Minuten",
  "confidence": 0.92
}`;

    try {
        let analysis;
        try {
            analysis = await chatJSON({ system: systemPrompt, prompt: userPrompt, model: 'fast', maxTokens: 1024 });
        } catch {
            analysis = { root_cause: 'Analyse fehlgeschlagen', action_plan: [] };
        }

        const plan = analysis.action_plan || [];
        const requiresApproval = plan.some(s => s.requires_approval !== false);

        await query(
            `UPDATE agent_tasks
             SET status = $1, ai_analysis = $2, action_plan = $3, requires_approval = $4, updated_at = NOW()
             WHERE id = $5`,
            [
                requiresApproval ? 'awaiting_approval' : 'action_planned',
                JSON.stringify(analysis),
                JSON.stringify(plan),
                requiresApproval,
                taskId,
            ]
        );

        // Insert action rows
        for (const step of plan) {
            await query(
                `INSERT INTO agent_actions (task_id, step_index, action_type, action_label, payload, status)
                 VALUES ($1, $2, $3, $4, $5, 'pending')`,
                [taskId, step.step, step.action_type, step.label, JSON.stringify(step.payload || {})]
            );
        }

        // Auto-execute: run immediately if plan has no risky steps,
        // or if severity is low/medium (agent acts autonomously by default)
        const settingResult = await query(
            `SELECT auto_approve_low, auto_approve_medium, auto_approve_high FROM agent_settings WHERE user_id = $1`,
            [task.user_id]
        );
        const s = settingResult.rows[0] ?? { auto_approve_low: true, auto_approve_medium: true, auto_approve_high: false };

        const autoRun =
            !requiresApproval ||
            (task.severity === 'low'    && s.auto_approve_low    !== false) ||
            (task.severity === 'medium' && s.auto_approve_medium !== false);

        if (autoRun) {
            console.log(`[Agent] Auto-executing task ${taskId} (severity: ${task.severity}, requiresApproval: ${requiresApproval})`);
            await executeTask(taskId, task.user_id);
        }
    } catch (err) {
        await query(
            `UPDATE agent_tasks SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2`,
            [err.message, taskId]
        );
    }
}

// ─── Execute approved task ───────────────────────────────────────────────────

async function executeTask(taskId, approvedByUserId) {
    const taskResult = await query(`SELECT * FROM agent_tasks WHERE id = $1`, [taskId]);
    const task = taskResult.rows[0];
    if (!task || !['awaiting_approval', 'action_planned'].includes(task.status)) {
        throw new Error('Task nicht ausführbar: falscher Status');
    }

    await query(
        `UPDATE agent_tasks SET status = 'executing', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [approvedByUserId, taskId]
    );

    const actions = await query(
        `SELECT * FROM agent_actions WHERE task_id = $1 ORDER BY step_index ASC`,
        [taskId]
    );

    const executionLog = [];

    for (const action of actions.rows) {
        await query(
            `UPDATE agent_actions SET status = 'running', executed_at = NOW() WHERE id = $1`,
            [action.id]
        );

        try {
            const result = await executeAction(task, action);
            await query(
                `UPDATE agent_actions SET status = 'done', result = $1 WHERE id = $2`,
                [JSON.stringify(result), action.id]
            );
            executionLog.push({ step: action.step_index, label: action.action_label, status: 'done', result });
        } catch (err) {
            await query(
                `UPDATE agent_actions SET status = 'failed', result = $1 WHERE id = $2`,
                [JSON.stringify({ error: err.message }), action.id]
            );
            executionLog.push({ step: action.step_index, label: action.action_label, status: 'failed', error: err.message });
            // Continue with remaining steps unless critical
        }
    }

    const anyFailed = executionLog.some(l => l.status === 'failed');
    const finalStatus = anyFailed ? 'failed' : 'done';
    await query(
        `UPDATE agent_tasks
         SET status = $1, execution_log = $2, completed_at = NOW(), updated_at = NOW()
         WHERE id = $3`,
        [finalStatus, JSON.stringify(executionLog), taskId]
    );

    // Notify admin what was done autonomously
    const doneSteps = executionLog.filter(l => l.status === 'done').map(l => l.label).join(', ');
    const notifTitle = finalStatus === 'done'
        ? `✅ Agent hat automatisch gehandelt: ${task.title}`
        : `⚠️ Agent: ${task.title} — teilweise fehlgeschlagen`;
    const notifMsg = doneSteps
        ? `Automatisch ausgeführt: ${doneSteps}`
        : 'Keine Aktionen konnten ausgeführt werden.';

    await query(
        `INSERT INTO notifications (user_id, type, title, message, data, created_at)
         VALUES ($1, 'agent_done', $2, $3, $4, NOW())`,
        [task.user_id, notifTitle, notifMsg, JSON.stringify({ taskId, siteId: task.site_id })]
    ).catch(() => {});

    return executionLog;
}

// ─── Execute a single action ─────────────────────────────────────────────────

async function executeAction(task, action) {
    const payload = action.payload || {};

    switch (action.action_type) {
        case 'clear_cache':
            // Signal WP plugin to clear cache via site API key
            return await sendCommandToSite(task.site_id, 'clear_cache', payload);

        case 'update_plugin':
            return await sendCommandToSite(task.site_id, 'update_plugin', payload);

        case 'rollback_plugin':
            return await sendCommandToSite(task.site_id, 'rollback_plugin', payload);

        case 'disable_plugin':
            return await sendCommandToSite(task.site_id, 'disable_plugin', payload);

        case 'fix_config':
            return await sendCommandToSite(task.site_id, 'fix_config', payload);

        case 'notify':
            // Create notification record
            await query(
                `INSERT INTO notifications (user_id, type, title, message, data, created_at)
                 SELECT user_id, 'agent_action', $1, $2, $3, NOW()
                 FROM agent_tasks WHERE id = $4`,
                [
                    `Agent: ${action.action_label}`,
                    `Automatische Aktion für Site ausgeführt: ${action.action_label}`,
                    JSON.stringify({ taskId: task.id }),
                    task.id,
                ]
            );
            return { notified: true };

        default:
            return { skipped: true, reason: `Unknown action type: ${action.action_type}` };
    }
}

// ─── Send command to WordPress site via Agent API ────────────────────────────

async function sendCommandToSite(siteId, command, payload) {
    const siteResult = await query(
        `SELECT domain, api_key FROM sites WHERE id = $1`,
        [siteId]
    );
    const site = siteResult.rows[0];
    if (!site) throw new Error('Site nicht gefunden');

    const url = `https://${site.domain}/wp-json/wpma/v1/agent-command`;
    const body = JSON.stringify({ command, payload, timestamp: Date.now() });

    const crypto = require('crypto');
    const signature = crypto.createHmac('sha256', site.api_key || '').update(body).digest('hex');

    const https = require('https');
    const urlParsed = new URL(url);

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: urlParsed.hostname,
            path: urlParsed.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'X-WPMA-Signature': `sha256=${signature}`,
            },
            timeout: 15000,
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve({ raw: data }); }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => reject(new Error('Command timeout')));
        req.write(body);
        req.end();
    });
}

// ─── Reject a task ───────────────────────────────────────────────────────────

async function rejectTask(taskId, userId, reason) {
    await query(
        `UPDATE agent_tasks
         SET status = 'rejected', approved_by = $1, approved_at = NOW(),
             rejection_reason = $2, updated_at = NOW()
         WHERE id = $3 AND status = 'awaiting_approval'`,
        [userId, reason || 'Vom Nutzer abgelehnt', taskId]
    );
}

// ─── Scan a single site immediately after connection ─────────────────────────

async function scanSite(siteId, userId, io) {
    // Pull fresh health data from the WP site
    const siteResult = await query(
        'SELECT id, domain, site_url, api_key FROM sites WHERE id = $1 AND status = $2',
        [siteId, 'active']
    );
    if (!siteResult.rows.length) return;
    const site = siteResult.rows[0];
    const siteUrl = (site.site_url || '').replace(/\/$/, '');

    try {
        const res = await axios.get(`${siteUrl}/wp-json/wpma/v1/health`, {
            headers: { 'X-WPMA-Key': site.api_key || '', 'User-Agent': 'WPMA-Backend/1.0' },
            timeout: 15000,
            validateStatus: null,
        });

        if (res.status === 200 && res.data) {
            const h = res.data;
            const totalUpdates = h.total_updates || 0;
            await query(
                `UPDATE sites
                    SET health_score           = $1,
                        wordpress_version      = $2,
                        php_version            = $3,
                        update_count           = $4,
                        last_check             = CURRENT_TIMESTAMP,
                        last_plugin_connection = COALESCE(last_plugin_connection, CURRENT_TIMESTAMP),
                        updated_at             = CURRENT_TIMESTAMP
                  WHERE id = $5`,
                [h.health_score ?? null, h.wordpress_version ?? null, h.php_version ?? null, totalUpdates, siteId]
            );
        }
    } catch (_) {
        // Health pull failed — continue with existing DB data
    }

    // Detect issues from (potentially updated) site data
    const issues = await detectIssues(siteId);
    const createdTasks = [];
    for (const issue of issues) {
        try {
            const task = await createTask(siteId, userId, issue);
            createdTasks.push(task);
        } catch (_) {}
    }

    // Send in-app notification to admin summarizing findings
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const highCount     = issues.filter(i => i.severity === 'high').length;

    let title, message;
    if (issues.length === 0) {
        title   = `✅ ${site.domain} verbunden — alles in Ordnung`;
        message = 'Der WPMA Agent hat keinen Handlungsbedarf festgestellt.';
    } else {
        title   = `🤖 Agent-Erstcheck: ${issues.length} Aufgabe${issues.length > 1 ? 'n' : ''} für ${site.domain}`;
        const parts = [];
        if (criticalCount) parts.push(`${criticalCount} kritisch`);
        if (highCount)     parts.push(`${highCount} hoch`);
        const rest = issues.length - criticalCount - highCount;
        if (rest > 0)      parts.push(`${rest} weitere`);
        message = `Probleme gefunden: ${parts.join(', ')}. Der Agent hat Aktionspläne erstellt und wartet auf deine Freigabe.`;
    }

    const notifData = { siteId, domain: site.domain, issueCount: issues.length, taskIds: createdTasks.map(t => t.id) };

    try {
        await query(
            `INSERT INTO notifications (user_id, type, title, message, data, created_at)
             VALUES ($1, 'agent_scan', $2, $3, $4, NOW())`,
            [userId, title, message, JSON.stringify(notifData)]
        );
    } catch (err) {
        console.error('[Agent] Notification insert failed:', err.message);
    }

    // Push real-time notification via Socket.io
    if (io) {
        io.to(`user_${userId}`).emit('agent_scan_complete', {
            type: 'agent_scan',
            title,
            message,
            issueCount: issues.length,
            domain: site.domain,
            taskIds: notifData.taskIds,
        });
    }
}

// ─── Scan all active sites for issues (called by background job) ─────────────

async function scanAllSites() {
    const sitesResult = await query(
        `SELECT DISTINCT s.id, s.user_id
         FROM sites s
         WHERE s.status = 'active' AND s.last_plugin_connection IS NOT NULL
           AND s.last_plugin_connection > NOW() - INTERVAL '24 hours'`
    );

    for (const row of sitesResult.rows) {
        try {
            const issues = await detectIssues(row.id);
            for (const issue of issues) {
                await createTask(row.id, row.user_id, issue);
            }
        } catch (err) {
            console.error(`[Agent] scan failed for site ${row.id}:`, err.message);
        }
    }
}

// ─── Queries ─────────────────────────────────────────────────────────────────

async function getTasks(userId, { siteId, status, limit = 50, offset = 0 } = {}) {
    let sql = `
        SELECT t.*, s.domain, s.site_name,
               json_agg(a ORDER BY a.step_index) FILTER (WHERE a.id IS NOT NULL) AS actions
        FROM agent_tasks t
        JOIN sites s ON s.id = t.site_id
        LEFT JOIN agent_actions a ON a.task_id = t.id
        WHERE t.user_id = $1
    `;
    const params = [userId];
    let idx = 2;

    if (siteId) { sql += ` AND t.site_id = $${idx++}`; params.push(siteId); }
    if (status) { sql += ` AND t.status = $${idx++}`; params.push(status); }

    sql += ` GROUP BY t.id, s.domain, s.site_name ORDER BY t.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    return result.rows;
}

async function getTask(taskId, userId) {
    const result = await query(
        `SELECT t.*, s.domain, s.site_name,
                json_agg(a ORDER BY a.step_index) FILTER (WHERE a.id IS NOT NULL) AS actions
         FROM agent_tasks t
         JOIN sites s ON s.id = t.site_id
         LEFT JOIN agent_actions a ON a.task_id = t.id
         WHERE t.id = $1 AND t.user_id = $2
         GROUP BY t.id, s.domain, s.site_name`,
        [taskId, userId]
    );
    return result.rows[0] || null;
}

async function getStats(userId) {
    const result = await query(
        `SELECT
            COUNT(*) FILTER (WHERE status = 'awaiting_approval') AS pending_approval,
            COUNT(*) FILTER (WHERE status IN ('analyzing','executing')) AS running,
            COUNT(*) FILTER (WHERE status = 'done') AS completed,
            COUNT(*) FILTER (WHERE status = 'failed') AS failed,
            COUNT(*) FILTER (WHERE severity = 'critical' AND status NOT IN ('done','rejected')) AS critical_open,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS last_24h
         FROM agent_tasks WHERE user_id = $1`,
        [userId]
    );
    return result.rows[0];
}

async function getSettings(userId) {
    const result = await query(`SELECT * FROM agent_settings WHERE user_id = $1`, [userId]);
    if (result.rows.length) return result.rows[0];
    // Return defaults
    return {
        user_id: userId,
        auto_approve_low: true,
        auto_approve_medium: true,
        auto_approve_high: false,
        auto_approve_critical: false,
        notify_on_detection: true,
        notify_on_completion: true,
        enabled: true,
    };
}

async function saveSettings(userId, settings) {
    await query(
        `INSERT INTO agent_settings (user_id, auto_approve_low, auto_approve_medium, auto_approve_high,
            auto_approve_critical, notify_on_detection, notify_on_completion, enabled)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (user_id) DO UPDATE SET
            auto_approve_low = EXCLUDED.auto_approve_low,
            auto_approve_medium = EXCLUDED.auto_approve_medium,
            auto_approve_high = EXCLUDED.auto_approve_high,
            auto_approve_critical = EXCLUDED.auto_approve_critical,
            notify_on_detection = EXCLUDED.notify_on_detection,
            notify_on_completion = EXCLUDED.notify_on_completion,
            enabled = EXCLUDED.enabled,
            updated_at = NOW()`,
        [
            userId,
            settings.auto_approve_low ?? true,
            settings.auto_approve_medium ?? false,
            settings.auto_approve_high ?? false,
            settings.auto_approve_critical ?? false,
            settings.notify_on_detection ?? true,
            settings.notify_on_completion ?? true,
            settings.enabled ?? true,
        ]
    );
}

module.exports = {
    detectIssues,
    createTask,
    executeTask,
    rejectTask,
    scanSite,
    scanAllSites,
    getTasks,
    getTask,
    getStats,
    getSettings,
    saveSettings,
};
