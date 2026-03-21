const express = require('express');
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

const getUserId = (req) => req.user?.userId || req.user?.id;

// Ensure table exists at module load
async function ensureTable() {
  await query(`CREATE TABLE IF NOT EXISTS link_scans (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    user_id INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    total_links INTEGER DEFAULT 0,
    broken_links INTEGER DEFAULT 0,
    redirect_links INTEGER DEFAULT 0,
    results JSONB,
    error_message TEXT,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
  )`);
}
ensureTable().catch(console.error);

// Extract all hrefs from HTML string, return absolute URLs
function extractLinks(html, baseUrl) {
  const seen = new Set();
  const links = [];

  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return links;
  }

  // Match absolute http/https hrefs
  const absRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
  let match;
  while ((match = absRegex.exec(html)) !== null) {
    const url = match[1].trim();
    if (!seen.has(url)) {
      seen.add(url);
      links.push(url);
    }
  }

  // Match relative hrefs (starting with / or without scheme)
  const relRegex = /href=["'](\/[^"']*|(?!https?:\/\/|#|mailto:|tel:|javascript:)[^"']+)["']/gi;
  while ((match = relRegex.exec(html)) !== null) {
    const href = match[1].trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
      continue;
    }
    try {
      const absolute = new URL(href, base.origin).href;
      if (!seen.has(absolute)) {
        seen.add(absolute);
        links.push(absolute);
      }
    } catch {
      // skip malformed
    }
  }

  return links;
}

// Check a single link, return result object
async function checkLink(url) {
  const start = Date.now();
  let finalUrl = url;

  try {
    const response = await axios.head(url, {
      timeout: 5000,
      maxRedirects: 3,
      validateStatus: () => true, // don't throw on 4xx/5xx
    });

    const responseTime = Date.now() - start;
    const statusCode = response.status;

    // Axios resolves the final URL via request config after redirects
    if (response.request && response.request.res && response.request.res.responseUrl) {
      finalUrl = response.request.res.responseUrl;
    } else if (response.request && response.request.responseURL) {
      finalUrl = response.request.responseURL;
    } else if (response.config && response.config.url && response.config.url !== url) {
      finalUrl = response.config.url;
    }

    const redirectUrl = finalUrl !== url ? finalUrl : null;

    return {
      url,
      status_code: statusCode,
      is_broken: statusCode >= 400,
      redirect_url: redirectUrl,
      response_time_ms: responseTime,
    };
  } catch (err) {
    const responseTime = Date.now() - start;
    const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');

    return {
      url,
      status_code: 0,
      is_broken: true,
      redirect_url: null,
      response_time_ms: responseTime,
      error: isTimeout ? 'timeout' : (err.message || 'unknown error'),
    };
  }
}

// Async scan runner — runs after response is sent
async function runScan(scanId, siteUrl) {
  try {
    // Fetch homepage HTML
    let html;
    try {
      const response = await axios.get(siteUrl, {
        timeout: 10000,
        headers: { 'User-Agent': 'WPMA-LinkChecker/1.0' },
      });
      html = response.data;
    } catch (err) {
      await query(
        `UPDATE link_scans SET status='failed', error_message=$1, completed_at=NOW() WHERE id=$2`,
        [err.message || 'Failed to fetch homepage', scanId]
      );
      return;
    }

    if (typeof html !== 'string') {
      html = String(html);
    }

    // Extract and cap links
    const allLinks = extractLinks(html, siteUrl);
    const links = allLinks.slice(0, 200);

    // Check each link
    const results = [];
    for (const url of links) {
      const result = await checkLink(url);
      results.push(result);
    }

    const totalLinks = results.length;
    const brokenLinks = results.filter((r) => r.is_broken).length;
    const redirectLinks = results.filter((r) => r.redirect_url !== null).length;

    await query(
      `UPDATE link_scans
       SET status='completed',
           results=$1,
           total_links=$2,
           broken_links=$3,
           redirect_links=$4,
           completed_at=NOW()
       WHERE id=$5`,
      [JSON.stringify(results), totalLinks, brokenLinks, redirectLinks, scanId]
    );
  } catch (err) {
    await query(
      `UPDATE link_scans SET status='failed', error_message=$1, completed_at=NOW() WHERE id=$2`,
      [err.message || 'Scan failed', scanId]
    );
  }
}

// POST /:siteId/scan — Start async link scan
router.post('/:siteId/scan', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  const { siteId } = req.params;

  try {
    // Verify site belongs to user
    const siteResult = await query(
      'SELECT * FROM sites WHERE id=$1 AND user_id=$2',
      [siteId, userId]
    );

    if (siteResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Site not found' });
    }

    const site = siteResult.rows[0];
    const siteUrl = site.site_url || `https://${site.domain}`;

    // Create scan record
    const scanResult = await query(
      `INSERT INTO link_scans (site_id, user_id, status, started_at)
       VALUES ($1, $2, 'running', NOW())
       RETURNING id`,
      [siteId, userId]
    );

    const scanId = scanResult.rows[0].id;

    // Respond immediately
    res.json({
      success: true,
      data: {
        scanId,
        message: 'Link scan started. Check /latest for results.',
      },
    });

    // Fire-and-forget async scan
    runScan(scanId, siteUrl);
  } catch (err) {
    console.error('Link scan start error:', err);
    res.status(500).json({ success: false, error: 'Failed to start scan' });
  }
});

// GET /:siteId/latest — Get latest completed scan with full results
router.get('/:siteId/latest', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  const { siteId } = req.params;

  try {
    const result = await query(
      `SELECT ls.*
       FROM link_scans ls
       JOIN sites s ON s.id = ls.site_id
       WHERE ls.site_id = $1
         AND s.user_id = $2
       ORDER BY ls.created_at DESC
       LIMIT 1`,
      [siteId, userId]
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Link scan latest error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch latest scan' });
  }
});

// GET /:siteId/history — Last 10 scans (stats only, no full results)
router.get('/:siteId/history', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  const { siteId } = req.params;

  try {
    const result = await query(
      `SELECT ls.id, ls.site_id, ls.user_id, ls.status,
              ls.total_links, ls.broken_links, ls.redirect_links,
              ls.error_message, ls.started_at, ls.completed_at, ls.created_at
       FROM link_scans ls
       JOIN sites s ON s.id = ls.site_id
       WHERE ls.site_id = $1
         AND s.user_id = $2
       ORDER BY ls.created_at DESC
       LIMIT 10`,
      [siteId, userId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Link scan history error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch scan history' });
  }
});

module.exports = router;
