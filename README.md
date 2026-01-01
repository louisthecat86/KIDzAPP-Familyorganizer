# KIDzAPP - Family Organizer with Bitcoin Rewards

A family organization app that gamifies household chores using Bitcoin/Lightning Network payments. Parents create tasks with satoshi rewards, children complete tasks and earn real Bitcoin!

## Features

- **Task Management** - Create tasks with Bitcoin rewards, assign to children, approve completions
- **Lightning Payments** - Three options: Fully automatic via LNbits or NWC, or fully manual via QR codes/Lightning invoices
- **Family Calendar** - Shared events with RSVP functionality
- **Family Chat** - Real-time messaging for the whole family
- **Allowances** - Automated weekly Bitcoin allowances
- **Bitcoin Education** - 60+ daily challenges to learn about Bitcoin
- **Shopping List** - Shared family shopping list
- **Location Sharing** - GPS tracking with interactive maps
- **Emergency Contacts** - Quick access to important numbers
- **Password Safe** - Parent-only encrypted password storage
- **Birthday Reminders** - Never forget a family birthday
- **Web Push Notifications** - Stay updated on task approvals and payments
- **Multi-Language** - German and English support

## Quick Start (Development)

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5000`

### Manual Payment Mode (QR Codes)

This mode allows using the app without a pre-configured Lightning wallet (LNbits/NWC). It's ideal for parents who want to manage payments manually from their own wallet.

1.  **Child Setup**: Each child must enter their Lightning Address in their profile.
2.  **Parent Setup**: Go to **Settings > Wallet**, select the **Manual** tab, and click **Activate Manual Mode**.
3.  **Task Creation**: Parents can now create tasks without any wallet connection or balance check.
4.  **Payment Flow**:
    -   When a task is approved or a bonus is granted, the app generates a Lightning invoice for the child's address.
    -   A QR code is displayed to the parent.
    -   The parent scans the QR code with any Bitcoin/Lightning wallet (e.g., Alby, Phoenix, BlueWallet) and pays it.
    -   Once paid, the parent clicks "Confirm Payment" in the app to update the status.

---

## Self-Hosting Guide

### Prerequisites

- **Node.js 20+** (LTS recommended)
- **PostgreSQL 14+** (or Neon serverless)
- **npm** or **pnpm**

### Option 1: Manual Installation

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
# Copy the example environment file
cp .env.example .env

# Edit with your values
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
# Create database (if not using Neon)
createdb kidzapp

# Run migrations
npm run db:push
```

#### 5. Build for Production

```bash
npm run build
```

#### 6. Start the Application

```bash
# Production mode
NODE_ENV=production node dist/index.js

# Or use the npm script
npm start
```

### Option 2: Docker Installation (Recommended)

#### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/kidzapp.git
cd kidzapp
```

#### 2. Configure Environment

```bash
# Create .env file with your secrets
cat > .env << EOF
DB_PASSWORD=your-secure-database-password
SESSION_SECRET=$(openssl rand -hex 32)
WALLET_ENCRYPTION_KEY=$(openssl rand -hex 16)
EOF
```

#### 3. Start with Docker Compose

```bash
# Build and start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

The app will be available at `http://localhost:5000`

#### 4. Run Database Migrations

The database schema needs to be initialized on first run:

```bash
# Wait for containers to be healthy, then run migrations
docker compose exec app npx drizzle-kit push

# Alternative: Run migrations before starting (recommended)
docker compose up postgres -d
docker compose run --rm app npx drizzle-kit push
docker compose up -d
```

**Note:** If you see database connection errors, wait a few seconds for PostgreSQL to be ready and try again.

---

## Production Deployment

### Reverse Proxy (Nginx)

For production, use a reverse proxy with SSL:

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
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d kidzapp.example.com
```

### Process Manager (PM2)

For non-Docker deployments, use PM2 to keep the app running:

```bash
# Install PM2
npm install -g pm2

# Start the app
pm2 start dist/index.js --name kidzapp

# Enable startup on boot
pm2 startup
pm2 save
```

---

## Troubleshooting

### Database Connection Issues

```bash
# Test PostgreSQL connection
psql $DATABASE_URL -c "SELECT 1"

# Check if database exists
psql -l | grep kidzapp
```

### Session Store Errors

- Ensure `SESSION_SECRET` is set and at least 32 characters
- Check PostgreSQL connection for session table

### Web Push Not Working

- Generate new VAPID keys: `npx web-push generate-vapid-keys`
- Ensure both `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are set
- Push notifications are optional - the app works without them

### Docker Container Won't Start

- Check logs: `docker compose logs app`
- Ensure PostgreSQL is healthy: `docker compose ps`
- Run migrations manually: `docker compose exec app npx drizzle-kit push`
- Verify environment variables are set correctly

### Health Check

The app exposes a health endpoint:

```bash
curl http://localhost:5000/api/health
# Returns: {"status":"healthy","timestamp":"...","version":"1.0.0"}
```

---

## Bitcoin/Lightning Configuration

Lightning payments are configured per-family through the app settings:

### LNBits (Self-Hosted)

1. Set up your own LNBits instance or use a hosted one
2. Create a wallet and get the Admin Key
3. Enter the URL and Admin Key in Family Settings

### Nostr Wallet Connect (NWC)

1. Get an NWC connection string from a compatible wallet (Alby, etc.)
2. Paste the connection string in Family Settings
3. NWC is preferred over LNBits when both are configured

---

## Development

### Project Structure

```
kidzapp/
├── client/           # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── i18n/     # Translations
│   │   └── lib/
│   └── public/
├── server/           # Express backend
│   ├── routes.ts     # API endpoints
│   ├── storage.ts    # Database operations
│   └── db.ts         # Database connection
├── shared/           # Shared types
│   └── schema.ts     # Drizzle schema
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run db:push      # Push schema to database
npm run db:studio    # Open Drizzle Studio
```

---

## Security

- All passwords are hashed with bcrypt (12 rounds)
- Sensitive wallet data encrypted with AES-256-GCM
- Session-based authentication with secure cookies
- Family data isolation (no cross-family access)
- PIN recovery via 12-word seed phrase (parents only)

---

## License

MIT License - See LICENSE file for details

---

## Support

For issues and feature requests, please open a GitHub issue.
