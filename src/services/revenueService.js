'use strict';

/**
 * WooCommerce Revenue Intelligence Service
 *
 * Sammelt WooCommerce-Daten, korreliert sie mit technischen Ereignissen
 * und erkennt automatisch Revenue-Impact durch Plugins, Performance, Downtime etc.
 */

const { chatJSON } = require('./llmService');
const { query } = require('../config/database');

// ─── Snapshot speichern (aus WP-Plugin gesendet) ─────────────────────────────

async function saveSnapshot(siteId, data) {
    const {
        period_start, period_end,
        total_revenue, order_count, avg_order_value,
        conversion_rate, cart_abandonment_rate,
        refund_amount, new_customers, returning_customers,
        raw_data,
    } = data;

    // Aktuelle technische Metriken hinzufügen
    const perfResult = await query(
        `SELECT page_load_time, cache_hit_ratio FROM performance_metrics
         WHERE site_id = $1 ORDER BY timestamp DESC LIMIT 1`,
        [siteId]
    );
    const perf = perfResult.rows[0];

    const uptimeResult = await query(
        `SELECT uptime_percentage FROM sites WHERE id = $1`,
        [siteId]
    );
    const uptime = uptimeResult.rows[0];

    const result = await query(
        `INSERT INTO revenue_snapshots
            (site_id, period_start, period_end, total_revenue, order_count, avg_order_value,
             conversion_rate, cart_abandonment_rate, refund_amount, new_customers, returning_customers,
             page_load_ms, uptime_pct, raw_data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [
            siteId,
            period_start || new Date(Date.now() - 86400000),
            period_end || new Date(),
            total_revenue || 0,
            order_count || 0,
            avg_order_value || 0,
            conversion_rate || 0,
            cart_abandonment_rate || 0,
            refund_amount || 0,
            new_customers || 0,
            returning_customers || 0,
            perf?.page_load_time || null,
            uptime?.uptime_percentage || null,
            JSON.stringify(raw_data || {}),
        ]
    );

    // Nach Einspeicherung Korrelationen prüfen
    detectCorrelations(siteId).catch(err =>
        console.error(`[Revenue] correlation check failed for site ${siteId}:`, err.message)
    );

    return result.rows[0];
}

// ─── WooCommerce Event erfassen ──────────────────────────────────────────────

async function recordEvent(siteId, eventType, amount, metadata) {
    await query(
        `INSERT INTO woocommerce_events (site_id, event_type, revenue_amount, metadata)
         VALUES ($1, $2, $3, $4)`,
        [siteId, eventType, amount || null, JSON.stringify(metadata || {})]
    );
}

// ─── Korrelations-Analyse (Claude) ───────────────────────────────────────────

async function detectCorrelations(siteId) {
    // Letzte 14 Tage Snapshots holen
    const snapshots = await query(
        `SELECT * FROM revenue_snapshots WHERE site_id = $1
         ORDER BY snapshot_at DESC LIMIT 14`,
        [siteId]
    );
    if (snapshots.rows.length < 3) return; // nicht genug Daten

    const siteResult = await query(`SELECT domain, wordpress_version FROM sites WHERE id = $1`, [siteId]);
    const site = siteResult.rows[0];
    if (!site) return;

    // Technische Events der letzten 14 Tage (Plugin-Updates, Downtime etc.)
    // agent_tasks als technische Incidents verwenden (category → type, description bleibt)
    const incidents = await query(
        `SELECT category AS type, description, created_at FROM agent_tasks
         WHERE site_id = $1 AND created_at > NOW() - INTERVAL '14 days'
         ORDER BY created_at DESC LIMIT 20`,
        [siteId]
    );

    // Revenue-Trend berechnen
    const data = snapshots.rows;
    const avgRevenueLast7 = data.slice(0, 7).reduce((s, r) => s + parseFloat(r.total_revenue), 0) / Math.min(7, data.length);
    const avgRevenuePrev7 = data.slice(7).reduce((s, r) => s + parseFloat(r.total_revenue), 0) / Math.max(1, data.slice(7).length);

    const deltaPct = avgRevenuePrev7 > 0
        ? ((avgRevenueLast7 - avgRevenuePrev7) / avgRevenuePrev7) * 100
        : 0;

    // Nur analysieren wenn signifikante Veränderung (>10%)
    if (Math.abs(deltaPct) < 10) return;

    const prompt = `Du bist Revenue Intelligence Analyst für WooCommerce-Sites.

Site: ${site.domain}
Revenue letzte 7 Tage (Ø/Tag): €${avgRevenueLast7.toFixed(2)}
Revenue vorherige 7 Tage (Ø/Tag): €${avgRevenuePrev7.toFixed(2)}
Veränderung: ${deltaPct.toFixed(1)}%

Letzte Snapshots (neueste zuerst):
${JSON.stringify(data.slice(0, 7).map(s => ({
    datum: s.snapshot_at,
    umsatz: s.total_revenue,
    bestellungen: s.order_count,
    conversion: s.conversion_rate,
    ladezeit_ms: s.page_load_ms,
    uptime: s.uptime_pct,
})), null, 2)}

Technische Events:
${JSON.stringify(incidents.rows.slice(0, 5).map(i => ({ typ: i.type, datum: i.created_at, beschreibung: i.description })), null, 2)}

Antworte NUR mit diesem JSON:
{
  "correlation_type": "performance_drop|plugin_update|downtime|security_issue|seasonal|unknown",
  "trigger_event": "Was hat den Revenue-Wandel ausgelöst?",
  "confidence": 0.0-1.0,
  "explanation": "Kurze Erklärung auf Deutsch",
  "recommendation": "Konkrete Handlungsempfehlung auf Deutsch",
  "estimated_monthly_impact": 0
}`;

    try {
        let analysis;
        try { analysis = await chatJSON({ prompt, model: 'smart', maxTokens: 512 }); }
        catch { return; }

        if (!analysis || analysis.confidence < 0.5) return;

        const existingCorr = await query(
            `SELECT id FROM revenue_correlations
             WHERE site_id = $1 AND trigger_event = $2
               AND detected_at > NOW() - INTERVAL '7 days'
             LIMIT 1`,
            [siteId, analysis.trigger_event]
        );
        if (existingCorr.rows.length) return;

        await query(
            `INSERT INTO revenue_correlations
                (site_id, correlation_type, trigger_event, trigger_at,
                 revenue_before, revenue_after, revenue_delta_pct,
                 revenue_loss_estimated, confidence, ai_explanation, ai_recommendation)
             VALUES ($1,$2,$3,NOW(),$4,$5,$6,$7,$8,$9,$10)`,
            [
                siteId,
                analysis.correlation_type,
                analysis.trigger_event,
                avgRevenuePrev7,
                avgRevenueLast7,
                deltaPct,
                deltaPct < 0 ? Math.abs(avgRevenueLast7 - avgRevenuePrev7) * 30 : 0,
                analysis.confidence,
                analysis.explanation,
                analysis.recommendation,
            ]
        );
    } catch (err) {
        console.error('[Revenue] Claude analysis failed:', err.message);
    }
}

// ─── Revenue Summary für eine Site ───────────────────────────────────────────

async function getSummary(siteId, days = 30) {
    const snapshots = await query(
        `SELECT * FROM revenue_snapshots
         WHERE site_id = $1 AND snapshot_at > NOW() - INTERVAL '${parseInt(days)} days'
         ORDER BY snapshot_at ASC`,
        [siteId]
    );

    const correlations = await query(
        `SELECT * FROM revenue_correlations WHERE site_id = $1 ORDER BY detected_at DESC LIMIT 10`,
        [siteId]
    );

    const events = await query(
        `SELECT event_type, COUNT(*) as count, SUM(revenue_amount) as total
         FROM woocommerce_events
         WHERE site_id = $1 AND event_at > NOW() - INTERVAL '${parseInt(days)} days'
         GROUP BY event_type`,
        [siteId]
    );

    const rows = snapshots.rows;
    const totalRevenue = rows.reduce((s, r) => s + parseFloat(r.total_revenue || 0), 0);
    const totalOrders = rows.reduce((s, r) => s + (r.order_count || 0), 0);
    const avgConversion = rows.length
        ? rows.reduce((s, r) => s + parseFloat(r.conversion_rate || 0), 0) / rows.length
        : 0;
    const avgLoadMs = rows.filter(r => r.page_load_ms).length
        ? rows.filter(r => r.page_load_ms).reduce((s, r) => s + r.page_load_ms, 0) / rows.filter(r => r.page_load_ms).length
        : null;

    return {
        period_days: days,
        total_revenue: totalRevenue,
        total_orders: totalOrders,
        avg_conversion_rate: avgConversion,
        avg_load_ms: avgLoadMs,
        snapshots: rows,
        correlations: correlations.rows,
        event_summary: events.rows,
    };
}

// ─── Revenue-Impact Berechnung (für USP-Display) ─────────────────────────────

async function getRevenueImpact(siteId) {
    const result = await query(
        `SELECT
            COALESCE(SUM(revenue_loss_estimated), 0) AS total_loss_estimated,
            COUNT(*) FILTER (WHERE revenue_delta_pct < -10) AS negative_correlations,
            COUNT(*) FILTER (WHERE resolved_at IS NULL) AS unresolved
         FROM revenue_correlations WHERE site_id = $1`,
        [siteId]
    );
    return result.rows[0];
}

async function getCorrelations(siteId, limit = 20) {
    const result = await query(
        `SELECT * FROM revenue_correlations WHERE site_id = $1
         ORDER BY detected_at DESC LIMIT $2`,
        [siteId, limit]
    );
    return result.rows;
}

async function markCorrelationResolved(correlationId, siteId, action) {
    await query(
        `UPDATE revenue_correlations SET resolved_at = NOW(), action_taken = $1
         WHERE id = $2 AND site_id = $3`,
        [action, correlationId, siteId]
    );
}

module.exports = {
    saveSnapshot,
    recordEvent,
    detectCorrelations,
    getSummary,
    getRevenueImpact,
    getCorrelations,
    markCorrelationResolved,
};
