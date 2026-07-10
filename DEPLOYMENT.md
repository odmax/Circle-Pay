# Circle Pay — Deployment Guide

## Prerequisites

- Node.js 20+
- PostgreSQL database (Neon recommended)
- PayFast merchant account (for payments)
- Vercel account (for hosting)

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `AUTH_SECRET` | Yes | NextAuth secret — `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | No | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | No | Google OAuth client secret |
| `PAYFAST_MERCHANT_ID` | No | PayFast merchant ID |
| `PAYFAST_MERCHANT_KEY` | No | PayFast merchant key |
| `PAYFAST_PASSPHRASE` | No | PayFast passphrase |
| `PAYFAST_SANDBOX` | No | Set to `true` for sandbox testing |
| `OWNER_EMAIL` | Yes | Email to auto-assign SUPER_ADMIN role on registration |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL (https://circlepay.vercel.app) |

## Database Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to database (first deploy)
npx prisma db push

# Or use migrations for production
npx prisma migrate deploy
```

## Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Set all environment variables in Vercel dashboard
4. Deploy

The `prisma generate` runs automatically on `postinstall` during Vercel builds.

## Post-Deploy Checklist

- [ ] Register with `OWNER_EMAIL` to activate admin access
- [ ] Navigate to `/owner` to verify admin dashboard
- [ ] Create a test circle and verify all features
- [ ] Test PayFast sandbox payment
- [ ] Verify notifications are working
- [ ] Check `/pricing` page is public
- [ ] Check `/billing/success` and `/billing/cancel` are public

## Architecture

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL via Prisma 7
- **Auth**: NextAuth v5 (Credentials + Google)
- **Payments**: PayFast ITN webhooks
- **UI**: Tailwind CSS v4 + shadcn/ui v4
- **Hosting**: Vercel (serverless)
