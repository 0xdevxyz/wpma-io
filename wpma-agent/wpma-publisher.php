<?php
/**
 * wpma-publisher.php — Standalone Content Publishing Agent
 *
 * Diese einzelne Datei auf dem Ziel-Server ablegen:
 *   → https://example.com/wpma-publisher.php
 *
 * Dann die URL im wpma.io Dashboard eintragen.
 *
 * Konfiguration: WPMA_AGENT_SECRET als Umgebungsvariable
 * oder direkt in dieser Datei setzen (Zeile 25).
 *
 * @version 1.0.0
 * @link    https://wpma.io
 */

define('WPMA_AGENT_SECRET', getenv('WPMA_AGENT_SECRET') ?: '');
// Direktes Setzen (nur wenn keine Env-Variable möglich):
// define('WPMA_AGENT_SECRET', 'hier-deinen-token-einsetzen');

define('WPMA_ALLOWED_IPS',      []);           // Leer = alle IPs erlaubt
define('WPMA_CONTENT_DIR',      __DIR__ . '/wpma-content/');
define('WPMA_MAX_REQUEST_AGE',  120);          // Sekunden (Replay-Schutz)
define('WPMA_LOG_FILE',         __DIR__ . '/wpma-publisher.log');

// Alle Klassen und Logik ist in includes/class-wpma-publisher.php
// Für Standalone-Einsatz: Klasse direkt hier included:
require_once __DIR__ . '/includes/class-wpma-publisher.php';
