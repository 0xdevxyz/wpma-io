#!/bin/bash
# ============================================
# WPMA.io - Sichere Secrets Generator
# ============================================
# Dieses Script generiert sichere Passwörter
# und erstellt eine .env Datei aus dem Template.
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TEMPLATE_FILE="$PROJECT_DIR/env.secure.template"
OUTPUT_FILE="$PROJECT_DIR/.env"

echo "🔐 WPMA.io Secrets Generator"
echo "=============================="
echo ""

# Check if .env already exists
if [ -f "$OUTPUT_FILE" ]; then
    echo "⚠️  WARNUNG: .env existiert bereits!"
    read -p "Überschreiben? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Abgebrochen."
        exit 1
    fi
fi

# Generate secure passwords
echo "🔑 Generiere sichere Passwörter..."

POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
JWT_SECRET=$(openssl rand -base64 64)

# URL-encode the postgres password for DATABASE_URL
POSTGRES_PASSWORD_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$POSTGRES_PASSWORD'))" 2>/dev/null || echo "$POSTGRES_PASSWORD")

echo "✅ Passwörter generiert"
echo ""

# Create .env from template
if [ -f "$TEMPLATE_FILE" ]; then
    echo "📝 Erstelle .env aus Template..."
    
    sed -e "s|CHANGE_ME_STRONG_PASSWORD|$POSTGRES_PASSWORD|g" \
        -e "s|CHANGE_ME_REDIS_PASSWORD|$REDIS_PASSWORD|g" \
        -e "s|CHANGE_ME_GENERATE_WITH_openssl_rand_base64_64|$JWT_SECRET|g" \
        "$TEMPLATE_FILE" > "$OUTPUT_FILE"
    
    # Fix DATABASE_URL with encoded password
    sed -i "s|postgresql://wpma_user:$POSTGRES_PASSWORD@|postgresql://wpma_user:$POSTGRES_PASSWORD_ENCODED@|g" "$OUTPUT_FILE"
    
    echo "✅ .env erstellt: $OUTPUT_FILE"
else
    echo "❌ Template nicht gefunden: $TEMPLATE_FILE"
    exit 1
fi

echo ""
echo "=============================="
echo "🎉 Secrets erfolgreich generiert!"
echo ""
echo "📋 Generierte Werte (bitte sicher aufbewahren!):"
echo "   POSTGRES_PASSWORD: $POSTGRES_PASSWORD"
echo "   REDIS_PASSWORD:    $REDIS_PASSWORD"
echo "   JWT_SECRET:        [64 Bytes - siehe .env]"
echo ""
echo "⚠️  WICHTIG:"
echo "   1. Sichere diese Passwörter an einem sicheren Ort!"
echo "   2. Die .env Datei sollte NIEMALS in Git committed werden!"
echo "   3. Ergänze die optionalen Werte (OpenAI, Stripe, etc.)"
echo ""
echo "🚀 Nächste Schritte:"
echo "   1. Bearbeite .env und ergänze fehlende API-Keys"
echo "   2. Starte die Container: docker-compose up -d"
echo "=============================="

