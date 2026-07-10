# Circle Pay — Environment Variables

All environment variables required for Circle Pay to function.

## Required

| Variable | Example | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/circle-pay?sslmode=require` | Neon PostgreSQL connection |
| `AUTH_SECRET` | `abc123...` | NextAuth encryption key |
| `NEXT_PUBLIC_APP_URL` | `https://circlepay.vercel.app` | Public app URL |
| `OWNER_EMAIL` | `admin@mozetech.com` | Auto-assigns SUPER_ADMIN on registration |

## Optional — Auth

| Variable | Purpose |
|---|---|
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |

## Optional — Payments (PayFast)

| Variable | Purpose |
|---|---|
| `PAYFAST_MERCHANT_ID` | PayFast merchant ID |
| `PAYFAST_MERCHANT_KEY` | PayFast merchant key |
| `PAYFAST_PASSPHRASE` | PayFast passphrase (optional) |
| `PAYFAST_SANDBOX` | `true` for sandbox, `false` for live |

## Local Development

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in your values and run:

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```
