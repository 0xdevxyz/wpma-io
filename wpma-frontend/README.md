# WPMA.io Frontend

Das Frontend für die WPMA.io WordPress Management AI Platform - eine moderne React/Next.js Anwendung mit TypeScript und Tailwind CSS.

## 🚀 Features

- **Modernes Dashboard**: Übersichtliche Darstellung aller WordPress-Sites
- **Echtzeit-Updates**: Live-Updates über WebSocket-Verbindungen
- **Responsive Design**: Optimiert für Desktop, Tablet und Mobile
- **Dark/Light Mode**: Unterstützung für verschiedene Themes
- **KI-Integration**: AI-gestützte Insights und Empfehlungen
- **Performance-Monitoring**: Detaillierte Performance-Metriken
- **Sicherheits-Scans**: Automatisierte Sicherheitsüberprüfungen
- **Backup-Management**: Vollständiges Backup-System

## 🛠️ Technologie-Stack

- **Framework**: Next.js 15 mit App Router
- **Sprache**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **API Client**: Axios mit React Query
- **UI Components**: Lucide React Icons
- **Animations**: Framer Motion
- **Forms**: React Hook Form
- **Charts**: Recharts
- **Notifications**: React Hot Toast

## 📦 Installation

1. **Dependencies installieren**:
   ```bash
   npm install
   ```

2. **Umgebungsvariablen konfigurieren**:
   Erstellen Sie eine `.env.local` Datei:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3000
   NEXT_PUBLIC_APP_NAME=WPMA.io
   NEXT_PUBLIC_APP_VERSION=1.0.0
   NEXT_PUBLIC_ENVIRONMENT=development
   NEXT_PUBLIC_DEBUG=true
   ```

3. **Entwicklungsserver starten**:
   ```bash
   npm run dev
   ```

4. **Browser öffnen**:
   Navigieren Sie zu [http://localhost:3001](http://localhost:3001)

## 🏗️ Projektstruktur

```
wpma-frontend/
├── app/                    # Next.js App Router
│   ├── auth/              # Authentifizierung
│   │   ├── login/         # Login-Seite
│   │   └── register/      # Registrierungs-Seite
│   ├── dashboard/         # Haupt-Dashboard
│   ├── globals.css        # Globale Styles
│   ├── layout.tsx         # Root Layout
│   └── page.tsx           # Homepage
├── components/            # React Komponenten
│   ├── dashboard/         # Dashboard-spezifische Komponenten
│   │   ├── site-card.tsx  # Site-Karte
│   │   └── stats-card.tsx # Statistiken-Karte
│   └── ui/               # Wiederverwendbare UI-Komponenten
│       ├── button.tsx    # Button-Komponente
│       └── card.tsx      # Card-Komponente
├── lib/                  # Utilities und Services
│   ├── api.ts           # API-Client
│   └── auth-store.ts    # Authentifizierung Store
├── public/              # Statische Assets
└── package.json         # Dependencies und Scripts
```

## 🔧 Entwicklung

### Verfügbare Scripts

- `npm run dev` - Startet den Entwicklungsserver
- `npm run build` - Erstellt eine Production-Build
- `npm run start` - Startet den Production-Server
- `npm run lint` - Führt ESLint aus

### Code-Struktur

#### Komponenten
- **UI Components**: Wiederverwendbare Basis-Komponenten
- **Dashboard Components**: Spezifische Dashboard-Funktionalitäten
- **Layout Components**: Layout und Navigation

#### State Management
- **Zustand Stores**: Lokaler State für Auth, Sites, etc.
- **React Query**: Server State Management
- **Context**: Globale App-State

#### API Integration
- **Axios Client**: HTTP-Requests mit Interceptors
- **React Query**: Caching und Synchronisation
- **WebSocket**: Echtzeit-Updates

## 🎨 Design System

### Farben
- **Primary**: Blue-600 (#2563EB)
- **Success**: Green-600 (#16A34A)
- **Warning**: Yellow-600 (#CA8A04)
- **Error**: Red-600 (#DC2626)
- **Neutral**: Gray-50 bis Gray-900

### Typography
- **Font**: Inter
- **Headings**: Font-weight 600-700
- **Body**: Font-weight 400-500

### Spacing
- **Base Unit**: 4px (0.25rem)
- **Container**: max-width 7xl (80rem)
- **Gap**: 6 (1.5rem) für Grid-Layouts

## 🔐 Authentifizierung

Das Frontend verwendet JWT-Token für die Authentifizierung:

1. **Login/Register**: Token wird im localStorage gespeichert
2. **API Requests**: Token wird automatisch in Headers eingefügt
3. **Token Refresh**: Automatische Token-Erneuerung
4. **Logout**: Token wird aus localStorage entfernt

## 📱 Responsive Design

- **Mobile First**: Design beginnt mit Mobile-Layout
- **Breakpoints**: sm (640px), md (768px), lg (1024px), xl (1280px)
- **Grid System**: Responsive Grid mit Tailwind CSS
- **Touch Friendly**: Optimiert für Touch-Interaktionen

## 🚀 Deployment

### Vercel (Empfohlen)
1. Repository zu Vercel verbinden
2. Umgebungsvariablen konfigurieren
3. Automatisches Deployment bei Git-Push

### Docker
```bash
# Build Image
docker build -t wpma-frontend .

# Run Container
docker run -p 3001:3000 wpma-frontend
```

### Manuell
```bash
npm run build
npm run start
```

## 🔧 Konfiguration

### Umgebungsvariablen

| Variable | Beschreibung | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_NAME` | App Name | `WPMA.io` |
| `NEXT_PUBLIC_DEBUG` | Debug Mode | `false` |

### API Endpoints

Das Frontend kommuniziert mit folgenden Backend-Endpoints:

- **Auth**: `/api/v1/auth/*`
- **Sites**: `/api/v1/sites/*`
- **Security**: `/api/v1/security/*`
- **Backup**: `/api/v1/backup/*`
- **Performance**: `/api/v1/performance/*`
- **AI**: `/api/v1/ai/*`

## 🧪 Testing

### Unit Tests
```bash
npm run test
```

### E2E Tests
```bash
npm run test:e2e
```

### Storybook
```bash
npm run storybook
```

## 📊 Performance

- **Bundle Size**: < 500KB (gzipped)
- **Lighthouse Score**: > 90
- **Core Web Vitals**: Optimiert
- **Image Optimization**: Next.js Image Component
- **Code Splitting**: Automatisch durch Next.js

## 🔒 Sicherheit

- **HTTPS Only**: In Production
- **CSP Headers**: Content Security Policy
- **XSS Protection**: React's built-in protection
- **CSRF Protection**: Token-basiert
- **Input Validation**: Client- und Server-seitig

## 🤝 Contributing

1. Fork das Repository
2. Erstellen Sie einen Feature Branch
3. Committen Sie Ihre Änderungen
4. Pushen Sie zum Branch
5. Erstellen Sie einen Pull Request

## 📄 Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert.

## 🆘 Support

Bei Fragen oder Problemen:

- **Issues**: GitHub Issues verwenden
- **Documentation**: Siehe `/docs` Ordner
- **Community**: Discord Server (Link folgt)

---

**WPMA.io** - Die KI-gestützte WordPress-Management-Plattform für proaktive Wartung, Sicherheit und Performance-Optimierung.
