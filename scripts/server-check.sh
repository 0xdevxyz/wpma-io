#!/usr/bin/env bash
# =============================================================================
# server-check.sh — Server Health & Outdated Package Checker
# Prüft: npm-Pakete, Docker, Node.js, System-Updates, Cryptominer
# Sendet Ergebnis per Telegram
#
# Einrichtung:
#   1. TELEGRAM_TOKEN + TELEGRAM_CHAT_ID unten eintragen
#   2. chmod +x /home/clawd/saas/wpma-io/server-check.sh
#   3. Cron: 0 8 * * 1 root /home/clawd/saas/wpma-io/server-check.sh
# =============================================================================

TELEGRAM_TOKEN="${TELEGRAM_TOKEN:-}"        # Von @BotFather: 1234567890:AAH...
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"   # Deine ID: @userinfobot anschreiben -> gibt dir die ID
SERVER_NAME="wpma-server"

NPM_PROJECTS=(
  "/home/clawd/saas/wpma-io"
  "/home/clawd/saas/wpma-io/wpma-frontend"
  "/home/clawd/saas/spamify"
  "/home/clawd/saas/spamify/dashboard"
  "/home/clawd/saas/contentflow-ai/frontend"
  "/home/clawd/saas/grantgpt/frontend"
  "/home/clawd/saas/loqal"
  "/home/clawd/saas/legal/dashboard-react"
  "/home/clawd/saas/securflow"
)

NODE_EOL="12 14 16 17 18 19 21"
MSG="" ISSUES=0 WARNINGS=0

log()   { MSG+="$1"$'\n'; }
issue() { MSG+="[KRITISCH] $1"$'\n'; ((ISSUES++)); }
warn()  { MSG+="[WARNUNG]  $1"$'\n'; ((WARNINGS++)); }
ok()    { MSG+="[OK]       $1"$'\n'; }

send_telegram() {
  if [[ -z "$TELEGRAM_TOKEN" || -z "$TELEGRAM_CHAT_ID" ]]; then
    echo "=== TELEGRAM NICHT KONFIGURIERT — lokale Ausgabe ==="
    echo "$MSG"
    return
  fi
  # URL-encode via python3
  ENCODED=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$MSG")
  curl -s "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
    -G \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${MSG}" \
    -d "parse_mode=HTML" \
    -d "disable_web_page_preview=true" \
    > /dev/null
}

# =============================================================================
DATE=$(date '+%d.%m.%Y %H:%M')
log "<b>Server-Check: ${SERVER_NAME}</b>"
log "<i>${DATE}</i>"
log ""

# --- SYSTEM ------------------------------------------------------------------
log "=== System ==="

MEM_TOTAL=$(free -m | awk '/^Mem:/{print $2}')
MEM_USED=$(free -m  | awk '/^Mem:/{print $3}')
MEM_PCT=$(( MEM_USED * 100 / MEM_TOTAL ))
SWAP_USED=$(free -m | awk '/^Swap:/{print $3}')
SWAP_TOTAL=$(free -m | awk '/^Swap:/{print $2}')

if   [[ $MEM_PCT -ge 90 ]]; then issue "RAM: ${MEM_USED}/${MEM_TOTAL}MB (${MEM_PCT}%) KRITISCH"
elif [[ $MEM_PCT -ge 75 ]]; then warn  "RAM: ${MEM_USED}/${MEM_TOTAL}MB (${MEM_PCT}%)"
else                              ok    "RAM: ${MEM_USED}/${MEM_TOTAL}MB (${MEM_PCT}%)"
fi

if [[ $SWAP_TOTAL -gt 0 ]]; then
  SWAP_PCT=$(( SWAP_USED * 100 / SWAP_TOTAL ))
  [[ $SWAP_PCT -ge 50 ]] && warn "Swap: ${SWAP_USED}/${SWAP_TOTAL}MB (${SWAP_PCT}%)"
fi

DISK_PCT=$(df / --output=pcent | tail -1 | tr -d ' %')
DISK_FREE=$(df -h / --output=avail | tail -1 | tr -d ' ')
if   [[ $DISK_PCT -ge 90 ]]; then issue "Disk: ${DISK_PCT}% voll (${DISK_FREE} frei)"
elif [[ $DISK_PCT -ge 80 ]]; then warn  "Disk: ${DISK_PCT}% voll (${DISK_FREE} frei)"
else                              ok    "Disk: ${DISK_PCT}% voll (${DISK_FREE} frei)"
fi

ZOMBIES=$(ps aux --no-headers | awk '$8=="Z"' | wc -l)
if   [[ $ZOMBIES -gt 50 ]]; then issue "Zombies: ${ZOMBIES} — moegl. Kompromittierung!"
elif [[ $ZOMBIES -gt 10 ]]; then warn  "Zombies: ${ZOMBIES}"
else                              ok    "Zombies: ${ZOMBIES}"
fi

log ""

# --- DOCKER ------------------------------------------------------------------
log "=== Docker ==="

UNHEALTHY=$(docker ps --filter "health=unhealthy" --format "{{.Names}}" 2>/dev/null | tr '\n' ' ')
[[ -n "$UNHEALTHY" ]] && issue "Unhealthy Container: ${UNHEALTHY}"

EXITED=$(docker ps -a --filter "status=exited" --format "{{.Names}}" 2>/dev/null | tr '\n' ' ')
[[ -n "$EXITED" ]] && warn "Gestoppt: ${EXITED}"

RUNNING=$(docker ps -q 2>/dev/null | wc -l)
ok "Laufend: ${RUNNING} Container"

MINER=0
for C in $(docker ps --format "{{.Names}}" 2>/dev/null); do
  # PostgreSQL.XXXXXXXX in /dev/shm ist normales Shared Memory — kein Miner
  SHM=$(docker exec "$C" sh -c "ls /dev/shm/ 2>/dev/null | grep -v '^$' | grep -vE '^PostgreSQL\.[0-9]+$'" 2>/dev/null)
  [[ -n "$SHM" ]] && { issue "MINER-ALARM /dev/shm in ${C}: ${SHM}"; MINER=1; }
  PROC=$(docker exec "$C" sh -c "ps aux 2>/dev/null | grep -E '/dev/shm/|/tmp/[a-z]{5}' | grep -v grep" 2>/dev/null)
  [[ -n "$PROC" ]] && { issue "MINER-PROZESS in ${C}: ${PROC:0:80}"; MINER=1; }
done
[[ $MINER -eq 0 ]] && ok "Kein Cryptominer gefunden"

log ""

# --- NODE.JS -----------------------------------------------------------------
log "=== Node.js ==="
NV=$(node --version 2>/dev/null | sed 's/v//')
NM=$(echo "$NV" | cut -d. -f1)
if echo "$NODE_EOL" | grep -wq "$NM"; then
  issue "Node.js ${NV} ist EOL — bitte auf v20 oder v22 upgraden!"
else
  ok "Node.js ${NV}"
fi
log ""

# --- NPM OUTDATED ------------------------------------------------------------
log "=== npm Pakete ==="

for DIR in "${NPM_PROJECTS[@]}"; do
  [[ ! -f "${DIR}/package.json" ]] && continue
  NAME=$(basename "$DIR")

  OUT=$(cd "$DIR" && npm outdated --json 2>/dev/null)
  if [[ -z "$OUT" || "$OUT" == "{}" ]]; then
    ok "${NAME}: aktuell"
    continue
  fi

  RESULT=$(python3 - <<PYEOF
import json, sys

raw = """${OUT}"""
try:
    data = json.loads(raw)
    lines = []
    for pkg, info in data.items():
        cur = info.get('current','?')
        lat = info.get('latest','?')
        cm = cur.split('.')[0].lstrip('^~>=<')
        lm = lat.split('.')[0].lstrip('^~>=<')
        tag = ' [MAJOR]' if cm.isdigit() and lm.isdigit() and cm != lm else ''
        lines.append(f'  {pkg}: {cur} -> {lat}{tag}')
    if len(lines) > 8:
        lines = lines[:8] + [f'  ...und {len(lines)-8} weitere']
    print('\n'.join(lines))
except Exception as e:
    print(f'  Fehler: {e}')
PYEOF
)

  if echo "$RESULT" | grep -q "\[MAJOR\]"; then
    issue "${NAME} (Major-Updates!):"$'\n'"${RESULT}"
  else
    warn "${NAME}:"$'\n'"${RESULT}"
  fi
done

log ""

# --- SYSTEM SECURITY UPDATES -------------------------------------------------
log "=== System-Updates ==="
if command -v apt &>/dev/null; then
  apt-get update -qq 2>/dev/null
  SEC=$(apt-get --simulate upgrade 2>/dev/null | grep "^Inst" | grep -i security | wc -l)
  ALL=$(apt-get --simulate upgrade 2>/dev/null | grep "^Inst" | wc -l)
  if   [[ $SEC -gt 0 ]]; then issue "${SEC} Security-Updates ausstehend (${ALL} gesamt)"
  elif [[ $ALL -gt 20 ]]; then warn  "${ALL} System-Updates ausstehend"
  else                          ok    "System aktuell (${ALL} optionale Updates)"
  fi
fi

log ""

# --- ZUSAMMENFASSUNG ---------------------------------------------------------
if   [[ $ISSUES   -gt 0 ]]; then log "<b>ERGEBNIS: ${ISSUES} KRITISCH, ${WARNINGS} Warnungen</b>"
elif [[ $WARNINGS -gt 0 ]]; then log "<b>ERGEBNIS: ${WARNINGS} Warnungen</b>"
else                              log "<b>ERGEBNIS: Alles OK</b>"
fi

send_telegram
echo "$(date '+%Y-%m-%d %H:%M:%S') | Issues: $ISSUES | Warnings: $WARNINGS" >> /var/log/server-check.log
