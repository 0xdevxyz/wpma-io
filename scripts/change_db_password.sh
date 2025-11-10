#!/bin/bash
#
# Dieses Skript ändert das Passwort für den Datenbankbenutzer 'wpma_user'
# und aktualisiert die .env-Datei automatisch.
#
set -e

# 1. BITTE ERSETZEN: Trage hier dein neues, sicheres Passwort ein.
KuKvYENV_FILE='/var/www/api.wpma.io/.env'

if [ "$NEW_PASSWORD" == "KuKvY%xxrthTtTce$2C4" ]; then
  echo "FEHLER: Bitte bearbeite dieses Skript und ersetze den Platzhalter für das Passwort in der Zeile NEW_PASSWORD."
  exit 1
fi

echo "Ändere das Passwort für den Benutzer 'wpma_user' in der Datenbank..."
echo "ALTER USER wpma_user WITH PASSWORD '$NEW_PASSWORD';" | sudo docker exec -i complyo-postgres psql -U postgres
echo "Datenbank-Passwort geändert."

echo ""
echo "Aktualisiere die DATABASE_URL in der Datei $ENV_FILE..."

# Ersetze das Passwort in der DATABASE_URL. Das sed-Kommando ist so aufgebaut, dass es mit Sonderzeichen im Passwort umgehen kann.
# Es sucht nach `postgresql://wpma_user:` gefolgt von allem bis zum `@` und ersetzt es.
sudo sed -i.bak "s|postgresql://wpma_user:.*@|postgresql://wpma_user:$NEW_PASSWORD@|" "$ENV_FILE"

echo ".env-Datei erfolgreich aktualisiert."
echo ""
echo "Der Prozess ist abgeschlossen."
