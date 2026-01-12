# KIDzAPP - Family Organizer with Bitcoin Rewards

A family organization app that gamifies household chores using Bitcoin/Lightning Network payments. Parents create tasks with satoshi rewards, children complete tasks, level up, and earn real Bitcoin!

## Features

### Task & Reward System
- **Task Management** - Create tasks with Bitcoin rewards (satoshi values)
- **XP & Level System** - Children earn XP for completing tasks and level up
- **Level Bonuses** - Automatic Bitcoin bonus rewards when leveling up
- **Required Tasks** - Free family tasks (no reward) that unlock paid tasks
- **Recurring Tasks** - Daily/weekly tasks that auto-regenerate
- **Photo Proof** - Children submit photo evidence of completed tasks
- **Bypass Mode** - Option to unlock tasks immediately without ratio requirement

### Bitcoin/Lightning Integration
- **Three Wallet Modes:**
  - **LNbits** - Self-hosted Lightning wallet (automatic payments)
  - **NWC (Nostr Wallet Connect)** - Use Alby or compatible wallets (automatic payments)
  - **Manual Mode** - QR code invoices for any Lightning wallet
- **Lightning Address Support** - Children receive payments to their own wallet
- **Automatic Allowances** - Weekly Bitcoin allowances on configurable day
- **Instant Payments** - Parents can send sats directly anytime
- **Transaction History** - Complete audit trail of all payments

### Family Features
- **Family Calendar** - Shared events with RSVP functionality
- **Family Chat** - Real-time messaging for the whole family
- **Shopping List** - Shared family shopping list
- **Family Board** - Pinned notes and announcements
- **Location Sharing** - GPS tracking with interactive maps
- **Emergency Contacts** - Quick access to important numbers
- **Password Safe** - Parent-only encrypted password storage
- **Birthday Reminders** - Never forget a family birthday

### Bitcoin Education
- **60+ Daily Challenges** - Learn about Bitcoin, Lightning, wallets, and more
- **Progressive Difficulty** - Topics from basics to advanced concepts
- **XP Rewards** - Earn experience for completing challenges

### Additional Features
- **Web Push Notifications** - Stay updated on task approvals and payments
- **Multi-Language** - German and English support
- **Dark Mode** - Eye-friendly dark theme
- **PWA Support** - Install as mobile app
- **PIN Recovery** - 12-word seed phrase for parent account recovery

---

## Quick Start (Development)

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5000`

---

## Wallet Configuration

### Option 1: LNbits (Automatic Payments)

1. Set up your own LNbits instance or use a hosted one
2. Create a wallet and get the Admin Key
3. Go to **Settings > Wallet > LNbits** tab
4. Enter the URL and Admin Key

### Option 2: NWC - Nostr Wallet Connect (Automatic Payments)

1. Get an NWC connection string from a compatible wallet (Alby, etc.)
2. Go to **Settings > Wallet > NWC** tab
3. Paste the connection string

### Option 3: Manual Mode (QR Codes)

This mode allows using the app without a pre-configured Lightning wallet. Ideal for parents who want to manage payments manually.

**Setup:**
1. **Child Setup**: Each child enters their Lightning Address in their profile
2. **Parent Setup**: Go to **Settings > Wallet > Manual** tab, click **Activate**
3. **Task Creation**: Create tasks without wallet connection

**Payment Flow:**
1. When a task is approved, a QR code appears with the Lightning invoice
2. Parent scans and pays with any Lightning wallet (Phoenix, BlueWallet, etc.)
3. Parent checks the confirmation box and clicks "Confirm"
4. Child's balance updates and task is marked complete

---

## Self-Hosting Guide

### Prerequisites

- **Node.js 20+** (LTS recommended)
- **PostgreSQL 14+** (or Neon serverless)
- **npm** or **pnpm**

### Manual Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/kidzapp.git
cd kidzapp
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Configure Environment

```bash
cp .env.example .env
nano .env
```

**Required Environment Variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/kidzapp` |
| `SESSION_SECRET` | Random 32+ character string | `openssl rand -hex 32` |
| `WALLET_ENCRYPTION_KEY` | Exactly 32 characters for AES-256 | `openssl rand -hex 16` |

**Optional Environment Variables:**

| Variable | Description |
|----------|-------------|
| `VAPID_PUBLIC_KEY` | Web Push public key |
| `VAPID_PRIVATE_KEY` | Web Push private key |
| `PORT` | Server port (default: 5000) |

Generate VAPID keys for push notifications:
```bash
npx web-push generate-vapid-keys
```

#### 4. Set Up Database

```bash
npm run db:push
```

#### 5. Build and Start

```bash
npm run build
NODE_ENV=production node dist/index.js
```

### Docker Installation

#### 1. Clone and Configure

```bash
git clone https://github.com/yourusername/kidzapp.git
cd kidzapp

cat > .env << EOF
DB_PASSWORD=your-secure-database-password
SESSION_SECRET=$(openssl rand -hex 32)
WALLET_ENCRYPTION_KEY=$(openssl rand -hex 16)
EOF
```

#### 2. Start with Docker Compose

```bash
docker compose up -d
docker compose exec app npx drizzle-kit push
```

The app will be available at `http://localhost:5000`

---

## Production Deployment

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name kidzapp.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name kidzapp.example.com;

    ssl_certificate /etc/letsencrypt/live/kidzapp.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kidzapp.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d kidzapp.example.com
```

### Process Manager (PM2)

```bash
npm install -g pm2
pm2 start dist/index.js --name kidzapp
pm2 startup
pm2 save
```

---

## Project Structure

```
kidzapp/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── i18n/           # Translations (de, en)
│   │   └── lib/            # Utilities
│   └── public/             # Static assets, service worker
├── server/                 # Express backend
│   ├── routes.ts           # API endpoints
│   ├── storage.ts          # Database operations
│   ├── lnbits.ts           # LNbits integration
│   ├── nwc.ts              # Nostr Wallet Connect
│   ├── lnurl.ts            # Lightning Address/LNURL
│   └── push.ts             # Web Push notifications
├── shared/                 # Shared types
│   └── schema.ts           # Drizzle ORM schema
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Express.js, TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **Lightning:** LNbits, NWC, LNURL-pay
- **State Management:** TanStack Query
- **Auth:** Session-based with bcrypt password hashing

---

## Security

- All passwords hashed with bcrypt (12 rounds)
- Sensitive wallet data encrypted with AES-256-GCM
- Session-based authentication with secure cookies
- Family data isolation (no cross-family access)
- PIN recovery via 12-word seed phrase (parents only)

---

## Troubleshooting

### Database Connection Issues
```bash
psql $DATABASE_URL -c "SELECT 1"
```

### Session Store Errors
- Ensure `SESSION_SECRET` is at least 32 characters
- Check PostgreSQL connection

### Web Push Not Working
- Generate new VAPID keys: `npx web-push generate-vapid-keys`
- Push notifications are optional

### Health Check
```bash
curl http://localhost:5000/api/health
```

---

## License

MIT License - See LICENSE file for details

---

## Support

For issues and feature requests, please open a GitHub issue.
