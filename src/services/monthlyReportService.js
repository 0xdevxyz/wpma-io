'use strict';

const { query } = require('../config/database');
const emailService = require('./emailService');

async function sendMonthlyReports() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based: month just ended
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

    const monthName = monthStart.toLocaleString('de-DE', { month: 'long', year: 'numeric' });

    const usersResult = await query(`SELECT id, email, name FROM users WHERE status = 'active'`);

    for (const user of usersResult.rows) {
        try {
            await sendReportForUser(user, monthStart, monthEnd, monthName);
        } catch (err) {
            console.error(`[MonthlyReport] Failed for user ${user.id}:`, err.message);
        }
    }
}

async function sendReportForUser(user, monthStart, monthEnd, monthName) {
    const sitesResult = await query(
        `SELECT id, domain, site_name, health_score, plugins_updates, themes_updates, core_update_available
         FROM sites WHERE user_id = $1 AND status = 'active'`,
        [user.id]
    );
    if (!sitesResult.rows.length) return;

    const taskStats = await query(
        `SELECT
            COUNT(*) FILTER (WHERE status = 'done') AS done,
            COUNT(*) FILTER (WHERE status = 'failed') AS failed,
            COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
            COUNT(*) AS total
         FROM agent_tasks
         WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3`,
        [user.id, monthStart, monthEnd]
    );
    const ts = taskStats.rows[0];

    const backupStats = await query(
        `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'completed') AS completed
         FROM backups b
         JOIN sites s ON s.id = b.site_id
         WHERE s.user_id = $1 AND b.created_at >= $2 AND b.created_at <= $3`,
        [user.id, monthStart, monthEnd]
    );
    const bs = backupStats.rows[0];

    const uptimeStats = await query(
        `SELECT
            AVG(uptime_percentage) AS avg_uptime,
            COUNT(*) FILTER (WHERE status = 'down') AS downtime_events
         FROM uptime_checks uc
         JOIN sites s ON s.id = uc.site_id
         WHERE s.user_id = $1 AND uc.checked_at >= $2 AND uc.checked_at <= $3`,
        [user.id, monthStart, monthEnd]
    );
    const us = uptimeStats.rows[0];

    const securityStats = await query(
        `SELECT COUNT(*) AS scans, AVG(security_score) AS avg_score
         FROM security_scans ss
         JOIN sites s ON s.id = ss.site_id
         WHERE s.user_id = $1 AND ss.created_at >= $2 AND ss.created_at <= $3`,
        [user.id, monthStart, monthEnd]
    );
    const sec = securityStats.rows[0];

    const html = buildReportHtml({
        user,
        monthName,
        sites: sitesResult.rows,
        tasks: ts,
        backups: bs,
        uptime: us,
        security: sec,
    });

    await emailService.send(
        user.email,
        `WPMA.io Monatsreport – ${monthName}`,
        html
    );

    console.log(`[MonthlyReport] Sent to ${user.email} for ${monthName}`);
}

function buildReportHtml({ user, monthName, sites, tasks, backups, uptime, security }) {
    const uptimePct = uptime.avg_uptime ? parseFloat(uptime.avg_uptime).toFixed(1) : 'N/A';
    const secScore = security.avg_score ? Math.round(parseFloat(security.avg_score)) : 'N/A';

    const siteRows = sites.map(s => {
        const updates = (s.plugins_updates || 0) + (s.themes_updates || 0) + (s.core_update_available ? 1 : 0);
        const health = s.health_score ?? '–';
        return `
            <tr>
                <td style="padding:10px 12px;border-bottom:1px solid #1e1e2e;color:#e2e8f0;">${s.site_name || s.domain}</td>
                <td style="padding:10px 12px;border-bottom:1px solid #1e1e2e;color:#94a3b8;">${s.domain}</td>
                <td style="padding:10px 12px;border-bottom:1px solid #1e1e2e;text-align:center;color:${health < 60 ? '#f87171' : health < 80 ? '#fbbf24' : '#4ade80'};">${health}%</td>
                <td style="padding:10px 12px;border-bottom:1px solid #1e1e2e;text-align:center;color:${updates > 0 ? '#60a5fa' : '#4ade80'};">${updates}</td>
            </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:40px 20px;">

  <!-- Header -->
  <div style="text-align:center;margin-bottom:40px;">
    <div style="display:inline-block;background:#1e1e2e;border:1px solid #2d2d44;border-radius:16px;padding:16px 32px;">
      <span style="font-size:22px;font-weight:700;color:#e2e8f0;">wpma<span style="color:#6366f1;">.io</span></span>
    </div>
    <h1 style="color:#e2e8f0;font-size:24px;font-weight:700;margin:24px 0 4px;">Monatsreport</h1>
    <p style="color:#64748b;font-size:15px;margin:0;">${monthName}</p>
  </div>

  <!-- Summary Cards -->
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:32px;">
    <div style="background:#1e1e2e;border:1px solid #2d2d44;border-radius:12px;padding:20px;">
      <p style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px;">Verfügbarkeit</p>
      <p style="color:#4ade80;font-size:28px;font-weight:700;margin:0;">${uptimePct}%</p>
      <p style="color:#64748b;font-size:12px;margin:4px 0 0;">${uptime.downtime_events || 0} Ausfall-Events</p>
    </div>
    <div style="background:#1e1e2e;border:1px solid #2d2d44;border-radius:12px;padding:20px;">
      <p style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px;">Security Score</p>
      <p style="color:${secScore < 60 ? '#f87171' : secScore < 80 ? '#fbbf24' : '#4ade80'};font-size:28px;font-weight:700;margin:0;">${secScore}</p>
      <p style="color:#64748b;font-size:12px;margin:4px 0 0;">${security.scans || 0} Scans durchgeführt</p>
    </div>
    <div style="background:#1e1e2e;border:1px solid #2d2d44;border-radius:12px;padding:20px;">
      <p style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px;">Agent-Aktionen</p>
      <p style="color:#e2e8f0;font-size:28px;font-weight:700;margin:0;">${tasks.done || 0}</p>
      <p style="color:#64748b;font-size:12px;margin:4px 0 0;">${tasks.failed || 0} fehlgeschlagen · ${tasks.rejected || 0} abgelehnt</p>
    </div>
    <div style="background:#1e1e2e;border:1px solid #2d2d44;border-radius:12px;padding:20px;">
      <p style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px;">Backups</p>
      <p style="color:#e2e8f0;font-size:28px;font-weight:700;margin:0;">${backups.completed || 0}</p>
      <p style="color:#64748b;font-size:12px;margin:4px 0 0;">${backups.total || 0} gesamt erstellt</p>
    </div>
  </div>

  <!-- Sites Table -->
  <div style="background:#1e1e2e;border:1px solid #2d2d44;border-radius:12px;overflow:hidden;margin-bottom:32px;">
    <div style="padding:16px 20px;border-bottom:1px solid #2d2d44;">
      <h2 style="color:#e2e8f0;font-size:14px;font-weight:600;margin:0;">Deine Sites (${sites.length})</h2>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#16162a;">
          <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;">Site</th>
          <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;">Domain</th>
          <th style="padding:10px 12px;text-align:center;color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;">Health</th>
          <th style="padding:10px 12px;text-align:center;color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;">Updates</th>
        </tr>
      </thead>
      <tbody>${siteRows}</tbody>
    </table>
  </div>

  <!-- CTA -->
  <div style="text-align:center;margin-bottom:40px;">
    <a href="${process.env.FRONTEND_URL || 'https://app.wpma.io'}/dashboard"
       style="display:inline-block;background:#6366f1;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">
      Dashboard öffnen
    </a>
  </div>

  <!-- Footer -->
  <p style="text-align:center;color:#374151;font-size:12px;">
    Dieser Report wurde automatisch von WPMA.io generiert.<br>
    © ${new Date().getFullYear()} wpma.io
  </p>
</div>
</body>
</html>`;
}

module.exports = { sendMonthlyReports };
