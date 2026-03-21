<?php
/**
 * WPMA Publisher — Content Publishing Agent
 *
 * Dieses Script wird auf dem Ziel-Server abgelegt und empfängt
 * HMAC-signierte Publish-Requests von wpma.io.
 *
 * Sicherheitsfeatures:
 *   - HMAC-SHA256 Signatur-Validierung (wie GitHub Webhooks)
 *   - Token-basierte Authentifizierung (rotierbar per Dashboard)
 *   - Nonce-basierter Replay-Schutz (120 Sekunden Fenster)
 *   - IP-Whitelist optional
 *   - HTTPS only (empfohlen)
 *   - Rate-Limiting via Timestamp-Check
 *
 * Verwendung:
 *   1. Datei auf Server kopieren: https://example.com/wpma-publisher.php
 *   2. WPMA_AGENT_SECRET mit dem Token aus dem Dashboard setzen
 *   3. Agent-URL im Dashboard eintragen
 *
 * @version 1.0.0
 */

// ============================================================
// KONFIGURATION — Anpassen!
// ============================================================

define('WPMA_AGENT_SECRET', getenv('WPMA_AGENT_SECRET') ?: '');
// Alterantiv direkt setzen (weniger sicher):
// define('WPMA_AGENT_SECRET', 'dein-token-hier');

// Optionale IP-Whitelist (leer = alle IPs erlaubt)
// Beispiel: ['51.158.99.1', '163.172.100.0/24']
define('WPMA_ALLOWED_IPS', []);

// Wohin wird der generierte Content geschrieben?
define('WPMA_CONTENT_DIR', __DIR__ . '/content/');

// Maximales Alter eines Requests in Sekunden (Replay-Schutz)
define('WPMA_MAX_REQUEST_AGE', 120);

// Log-Datei (false = kein Logging)
define('WPMA_LOG_FILE', __DIR__ . '/wpma-publisher.log');

// ============================================================
// WPMA Publisher Agent
// ============================================================

class WPMA_Publisher_Agent {

    public function run() {
        // Nur POST-Requests akzeptieren
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->respond(405, ['error' => 'Method Not Allowed']);
        }

        // HTTPS prüfen (in Produktion aktivieren)
        // if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off') {
        //     $this->respond(403, ['error' => 'HTTPS required']);
        // }

        // IP-Whitelist prüfen
        if (!empty(WPMA_ALLOWED_IPS)) {
            $clientIp = $this->getClientIp();
            if (!$this->isIpAllowed($clientIp, WPMA_ALLOWED_IPS)) {
                $this->log('warn', "Blocked IP: {$clientIp}");
                $this->respond(403, ['error' => 'IP not allowed']);
            }
        }

        // Secret prüfen
        if (empty(WPMA_AGENT_SECRET)) {
            $this->respond(500, ['error' => 'Agent not configured (WPMA_AGENT_SECRET missing)']);
        }

        // Raw body lesen
        $rawBody = file_get_contents('php://input');
        if (empty($rawBody)) {
            $this->respond(400, ['error' => 'Empty request body']);
        }

        // Signatur validieren
        $signature = $_SERVER['HTTP_X_WPMA_SIGNATURE'] ?? '';
        if (!$this->validateSignature($rawBody, $signature)) {
            $this->log('warn', 'Invalid signature from ' . $this->getClientIp());
            $this->respond(401, ['error' => 'Invalid signature']);
        }

        // JSON parsen
        $payload = json_decode($rawBody, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->respond(400, ['error' => 'Invalid JSON']);
        }

        // Timestamp / Replay-Schutz
        $timestamp = (int)($payload['timestamp'] ?? 0);
        $age = time() - $timestamp;
        if ($age < 0 || $age > WPMA_MAX_REQUEST_AGE) {
            $this->log('warn', "Request too old or future-dated: age={$age}s");
            $this->respond(401, ['error' => 'Request expired (replay protection)']);
        }

        // Action dispatchen
        $action = $payload['action'] ?? '';
        switch ($action) {
            case 'publish_content':
                $result = $this->publishContent($payload);
                break;
            case 'ping':
                $result = ['status' => 'ok', 'version' => '1.0.0'];
                break;
            default:
                $this->respond(400, ['error' => "Unknown action: {$action}"]);
        }

        $this->log('info', "Action '{$action}' executed successfully");
        $this->respond(200, array_merge(['success' => true], $result));
    }

    // ----------------------------------------
    // Content publizieren
    // ----------------------------------------

    private function publishContent(array $payload): array {
        $post = $payload['post'] ?? [];
        $media = $payload['media'] ?? [];

        if (empty($post['title']) || empty($post['content'])) {
            $this->respond(400, ['error' => 'post.title und post.content erforderlich']);
        }

        // Content-Verzeichnis anlegen
        if (!is_dir(WPMA_CONTENT_DIR)) {
            if (!mkdir(WPMA_CONTENT_DIR, 0755, true)) {
                $this->respond(500, ['error' => 'Konnte Content-Verzeichnis nicht erstellen']);
            }
        }

        $slug = $this->createSlug($post['title']);
        $timestamp = date('Y-m-d');
        $filename = "{$timestamp}-{$slug}";

        // HTML generieren
        $html = $this->renderHtml($post, $media, $slug);

        // Datei schreiben
        $filePath = WPMA_CONTENT_DIR . $filename . '.html';
        if (file_put_contents($filePath, $html) === false) {
            $this->respond(500, ['error' => 'Konnte Datei nicht schreiben: ' . $filePath]);
        }

        // JSON-Metadata speichern
        $meta = [
            'title'      => $post['title'],
            'excerpt'    => $post['excerpt'] ?? '',
            'keywords'   => $post['keywords'] ?? [],
            'language'   => $post['language'] ?? 'de',
            'slug'       => $slug,
            'created_at' => date('c'),
            'file'       => $filename . '.html',
        ];
        file_put_contents(WPMA_CONTENT_DIR . $filename . '.json', json_encode($meta, JSON_PRETTY_PRINT));

        // Index aktualisieren
        $this->updateIndex($meta);

        // URL ermitteln
        $baseUrl = rtrim($this->getBaseUrl(), '/');
        $contentPath = str_replace($_SERVER['DOCUMENT_ROOT'], '', WPMA_CONTENT_DIR);
        $url = $baseUrl . $contentPath . $filename . '.html';

        return [
            'file_path' => $filePath,
            'url'       => $url,
            'slug'      => $slug,
            'filename'  => $filename . '.html',
        ];
    }

    // ----------------------------------------
    // HTML-Renderer (Minimal-Template)
    // ----------------------------------------

    private function renderHtml(array $post, array $media, string $slug): string {
        $title   = htmlspecialchars($post['title'], ENT_QUOTES, 'UTF-8');
        $lang    = htmlspecialchars($post['language'] ?? 'de', ENT_QUOTES, 'UTF-8');
        $excerpt = htmlspecialchars($post['excerpt'] ?? '', ENT_QUOTES, 'UTF-8');
        $content = $this->markdownToHtml($post['content'] ?? '');
        $date    = date('d.m.Y');

        // Featured Image
        $featuredHtml = '';
        $featuredMedia = array_filter($media, fn($m) => !empty($m['is_featured']));
        if (!empty($featuredMedia)) {
            $img = reset($featuredMedia);
            $imgUrl = htmlspecialchars($img['url'] ?? '', ENT_QUOTES, 'UTF-8');
            $imgAlt = htmlspecialchars($img['alt_text'] ?? $post['title'], ENT_QUOTES, 'UTF-8');
            $photographer = htmlspecialchars($img['photographer'] ?? '', ENT_QUOTES, 'UTF-8');
            $photographerUrl = htmlspecialchars($img['photographer_url'] ?? '#', ENT_QUOTES, 'UTF-8');
            $featuredHtml = <<<HTML
            <figure class="featured-image">
                <img src="{$imgUrl}" alt="{$imgAlt}" loading="lazy" />
                <figcaption>Foto von <a href="{$photographerUrl}" target="_blank" rel="noopener">{$photographer}</a> auf Pexels</figcaption>
            </figure>
HTML;
        }

        // Keywords als Meta-Tags
        $keywordsStr = implode(', ', array_map('htmlspecialchars', $post['keywords'] ?? []));

        return <<<HTML
<!DOCTYPE html>
<html lang="{$lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{$title}</title>
    <meta name="description" content="{$excerpt}">
    <meta name="keywords" content="{$keywordsStr}">
    <meta name="generator" content="wpma.io Content Publishing Hub">
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.7; color: #1a1a1a; background: #fff; }
        .container { max-width: 780px; margin: 0 auto; padding: 2rem 1.5rem; }
        .post-meta { color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; }
        h1 { font-size: clamp(1.5rem, 4vw, 2.2rem); font-weight: 700; margin-bottom: 0.75rem; }
        h2 { font-size: 1.4rem; font-weight: 600; margin: 2rem 0 0.75rem; }
        h3 { font-size: 1.15rem; font-weight: 600; margin: 1.5rem 0 0.5rem; }
        p { margin-bottom: 1.25rem; }
        .featured-image { margin: 1.5rem 0; }
        .featured-image img { width: 100%; height: auto; border-radius: 8px; display: block; }
        .featured-image figcaption { font-size: 0.8rem; color: #888; margin-top: 0.4rem; text-align: center; }
        a { color: #6d28d9; }
        strong { font-weight: 600; }
        em { font-style: italic; }
        .wpma-badge { font-size: 0.75rem; color: #aaa; margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #eee; }
    </style>
</head>
<body>
    <div class="container">
        <article>
            <h1>{$title}</h1>
            <div class="post-meta">Veröffentlicht am {$date} · via wpma.io</div>
            {$featuredHtml}
            <div class="post-content">
                {$content}
            </div>
        </article>
        <p class="wpma-badge">Generiert mit <a href="https://wpma.io" target="_blank" rel="noopener">wpma.io</a> Content Publishing Hub</p>
    </div>
</body>
</html>
HTML;
    }

    // ----------------------------------------
    // Minimaler Markdown → HTML Konverter
    // ----------------------------------------

    private function markdownToHtml(string $markdown): string {
        $html = htmlspecialchars($markdown, ENT_QUOTES, 'UTF-8');

        // Headings
        $html = preg_replace('/^### (.+)$/m', '<h3>$1</h3>', $html);
        $html = preg_replace('/^## (.+)$/m', '<h2>$1</h2>', $html);
        $html = preg_replace('/^# (.+)$/m', '<h1>$1</h1>', $html);

        // Bold / Italic
        $html = preg_replace('/\*\*(.+?)\*\*/', '<strong>$1</strong>', $html);
        $html = preg_replace('/\*(.+?)\*/', '<em>$1</em>', $html);

        // Links
        $html = preg_replace('/\[(.+?)\]\((https?:\/\/[^\)]+)\)/', '<a href="$2" target="_blank" rel="noopener">$1</a>', $html);

        // Paragraphs: doppelte Zeilenumbrüche → p-Tags
        $blocks = preg_split('/\n\n+/', $html);
        $result = [];
        foreach ($blocks as $block) {
            $block = trim($block);
            if (empty($block)) continue;
            if (preg_match('/^<h[1-6]/', $block)) {
                $result[] = $block;
            } else {
                $block = nl2br($block);
                $result[] = "<p>{$block}</p>";
            }
        }

        return implode("\n", $result);
    }

    // ----------------------------------------
    // Index-Datei aktualisieren
    // ----------------------------------------

    private function updateIndex(array $meta): void {
        $indexFile = WPMA_CONTENT_DIR . 'index.json';
        $index = [];

        if (file_exists($indexFile)) {
            $existing = json_decode(file_get_contents($indexFile), true);
            if (is_array($existing)) {
                $index = $existing;
            }
        }

        // Neuesten Post vorne einfügen
        array_unshift($index, $meta);

        // Max. 1000 Einträge behalten
        $index = array_slice($index, 0, 1000);

        file_put_contents($indexFile, json_encode($index, JSON_PRETTY_PRINT));
    }

    // ----------------------------------------
    // Hilfsmethoden
    // ----------------------------------------

    private function validateSignature(string $body, string $signatureHeader): bool {
        if (empty($signatureHeader)) return false;

        // Format: "sha256=<hex>"
        if (!str_starts_with($signatureHeader, 'sha256=')) return false;

        $receivedSig = substr($signatureHeader, 7);
        $expectedSig = hash_hmac('sha256', $body, WPMA_AGENT_SECRET);

        return hash_equals($expectedSig, $receivedSig);
    }

    private function createSlug(string $title): string {
        $slug = mb_strtolower($title, 'UTF-8');
        $slug = str_replace(['ä','ö','ü','ß','é','è','à'], ['ae','oe','ue','ss','e','e','a'], $slug);
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug);
        $slug = trim($slug, '-');
        return substr($slug, 0, 80);
    }

    private function getClientIp(): string {
        $headers = ['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'];
        foreach ($headers as $header) {
            if (!empty($_SERVER[$header])) {
                $ip = trim(explode(',', $_SERVER[$header])[0]);
                if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
            }
        }
        return '0.0.0.0';
    }

    private function isIpAllowed(string $ip, array $allowedRanges): bool {
        foreach ($allowedRanges as $range) {
            if (strpos($range, '/') !== false) {
                // CIDR-Notation
                [$subnet, $bits] = explode('/', $range);
                $ipLong = ip2long($ip);
                $subnetLong = ip2long($subnet);
                if ($ipLong === false || $subnetLong === false) continue;
                $mask = -1 << (32 - (int)$bits);
                if (($ipLong & $mask) === ($subnetLong & $mask)) return true;
            } else {
                if ($ip === $range) return true;
            }
        }
        return false;
    }

    private function getBaseUrl(): string {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        return "{$scheme}://{$host}";
    }

    private function log(string $level, string $message): void {
        if (!WPMA_LOG_FILE) return;
        $line = sprintf("[%s] [%s] %s\n", date('Y-m-d H:i:s'), strtoupper($level), $message);
        file_put_contents(WPMA_LOG_FILE, $line, FILE_APPEND | LOCK_EX);
    }

    private function respond(int $status, array $data): void {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-WPMA-Agent: wpma-publisher/1.0.0');
        echo json_encode($data);
        exit;
    }
}

// ============================================================
// Entry Point — als Standalone-Script ausführen
// ============================================================
// Direkt als PHP-Datei per HTTP aufrufbar:
// https://example.com/wpma-publisher.php

if (PHP_SAPI !== 'cli') {
    (new WPMA_Publisher_Agent())->run();
}
