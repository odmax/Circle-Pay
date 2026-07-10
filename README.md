# Circle Pay

Group finance, simplified. Save, track expenses, and manage money together with your circles.

## Stack

- **Framework:** Next.js 16 (App Router + Turbopack)
- **Language:** TypeScript
- **Database:** PostgreSQL (Neon)
- **ORM:** Prisma 7
- **Auth:** NextAuth v5
- **UI:** Tailwind CSS v4 + shadcn/ui v4
- **Animations:** Framer Motion
- **Mobile:** Expo + React Native

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Fill in DATABASE_URL, AUTH_SECRET, etc.

# Push database schema
npx prisma db push

# Start dev server
npm run dev
```

## Key Features

- **Circles** — 9 circle types (Stokvel, Investment, Housemate, Travel, Savings, Wedding, Church, Family, Custom)
- **Wallet Ledger** — Immutable double-entry ledger with trial balance
- **Projects** — Funding rounds, contributions, expenses, assets, revenue, ROI, profit distribution
- **Automations** — Workflow engine with type-specific defaults and cron scheduling
- **Feature Gates** — Per-plan feature access (Free/Premium/Community)
- **Owner Dashboard** — Executive KPIs, analytics, admin management, fraud detection
- **Mobile App** — Expo companion with push notifications, QR scanner, proof upload

## Architecture

```
src/
├── app/                  # Next.js App Router
│   ├── (dashboard)/      # User pages
│   ├── owner/            # Admin pages
│   ├── api/              # API routes
│   ├── legal/            # Legal & Trust Center
│   └── join/             # Invite/join flow
├── lib/
│   └── services/         # 30+ service modules
├── components/           # Reusable UI components
└── generated/prisma/     # Prisma client
mobile/                   # Expo React Native app
prisma/                   # Database schema
```

## License

MIT
