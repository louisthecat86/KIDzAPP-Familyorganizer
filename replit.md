# KIDzAPP - Family Organizer

## Overview

KIDzAPP is a family organization application that gamifies chores and tasks using Bitcoin/Lightning Network payments. The app enables parents to create tasks with satoshi rewards, while children can complete tasks and receive Bitcoin payments directly to their Lightning addresses. The platform includes family event management, chat functionality, and automated allowance payments.

**Core Purpose:** Transform household chores into a Bitcoin-earning opportunity for children while teaching financial responsibility and providing family coordination tools.

**Tech Stack:**
- Frontend: React + TypeScript + Vite
- UI Framework: Radix UI + Tailwind CSS (shadcn/ui components)
- Backend: Express.js + TypeScript
- Database: PostgreSQL (via Neon serverless)
- ORM: Drizzle ORM
- Bitcoin Payments: Lightning Network (LNBits + Nostr Wallet Connect)
- State Management: TanStack Query (React Query)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Application Structure

**Monorepo Organization:**
- `/client` - React frontend application
- `/server` - Express backend API
- `/shared` - Shared TypeScript types and database schema
- Development and production build configurations separated (`index-dev.ts`, `index-prod.ts`)

**Database Architecture:**

The application uses PostgreSQL with Drizzle ORM. Schema is defined in `/shared/schema.ts` with the following core tables:

1. **peers** - User accounts (both parents and children)
   - Stores role-based access (parent/child)
   - PIN-based authentication (unique per name)
   - Family linking via `connectionId` (auto-generated family ID)
   - Bitcoin wallet integration (NWC connection strings, LNBits credentials, Lightning addresses)
   - Balance tracking in satoshis

2. **tasks** - Chore/task management
   - Linked to families via `connectionId`
   - Status workflow: open → assigned → submitted → approved
   - Satoshi rewards
   - Proof of completion (photo uploads)
   - Payment hash tracking for Lightning payments

3. **transactions** - Financial transaction history
   - Records all satoshi movements
   - Links to tasks or events
   - Transaction type categorization

4. **familyEvents** - Calendar events for families
   - Date/time, location, description
   - RSVP tracking via `eventRsvps` table

5. **chatMessages** - Family chat functionality
   - Real-time messaging between family members

6. **allowances** - Recurring Bitcoin allowance payments
   - Automated weekly payments from parent to child
   - Configurable amount and day of week
   - Cron-based scheduling

### Authentication & Security

**PIN-based Authentication:**
- No traditional username/password system
- Users identified by name + PIN combination
- PINs are unique per name (enforced at database level)
- Security question (favorite color) for PIN recovery
- Role-based access control (parent vs. child permissions)

**Family Isolation:**
- All data scoped to `connectionId` (family ID)
- Parents auto-generate connection IDs on registration
- Children join families by entering parent's connection ID
- No cross-family data access

### Bitcoin/Lightning Integration

**Dual Payment Provider Support:**

1. **LNBits Integration** (`/server/lnbits.ts`):
   - Self-hosted Lightning wallet solution
   - Parents configure instance URL + admin key
   - Creates invoices for task rewards
   - Checks payment status
   - Fallback endpoint detection (supports both new and legacy APIs)

2. **Nostr Wallet Connect (NWC)** (`/server/nwc.ts`):
   - Implements Nostr Wallet Connect protocol
   - WebSocket-based relay communication
   - Persistent connection management with reconnection logic
   - Encrypts payment requests using Nostr encryption
   - Supports direct Lightning payments without self-hosting

**Payment Flow:**
- Parents fund escrow wallet (NWC) or configure LNBits
- Tasks assigned satoshi values
- Children complete tasks and submit proof (photos)
- Parents approve tasks
- Automatic Lightning payment to child's Lightning address
- Transaction history maintained for audit trail

**Payment Method Priority:**
- NWC preferred (if configured)
- Falls back to LNBits
- Supports manual balance adjustments for testing

### Frontend Architecture

**Component Structure:**
- shadcn/ui design system (Radix UI primitives + Tailwind)
- Custom components: `PhotoUpload`, `ProofViewer`
- Responsive mobile-first design
- Dark mode support (enforced in HTML)
- PWA-capable (manifest.json, service worker ready)

**State Management:**
- TanStack Query for server state
- Optimistic updates for UI responsiveness
- Query invalidation on mutations
- Custom query client configuration (`/client/src/lib/queryClient.ts`)

**Routing:**
- Single-page application (SPA)
- Client-side routing handled in `App.tsx`
- Vite dev server with HMR

### API Design

**RESTful Endpoints** (`/server/routes.ts`):

- Wallet testing and configuration
- Peer/user CRUD operations
- Task lifecycle management (create, assign, submit, approve)
- Transaction history
- Family event management with RSVP
- Chat messaging
- Allowance configuration and processing

**Error Handling:**
- Centralized error responses
- Validation using Zod schemas
- Request/response logging middleware

### File Upload & Storage

**Photo Proof System:**
- Camera capture via Web APIs (`PhotoUpload.tsx`)
- Base64 encoding for image storage
- Direct database storage (no external file service)
- Image preview and viewer components

### Scheduled Jobs

**Cron-based Allowance Processing:**
- Weekly allowance payments
- Configured per child with day-of-week and satoshi amount
- Automated execution via node-cron
- Payment via configured Bitcoin provider (NWC/LNBits)
- Marks allowances as paid to prevent duplicates

### Development vs Production

**Development Mode:**
- Vite dev server with HMR
- Replit-specific plugins (cartographer, dev banner)
- Runtime error overlay
- Separate entry point (`index-dev.ts`)

**Production Mode:**
- Static file serving from `/dist`
- Bundled with esbuild
- No Vite dependency at runtime
- Separate entry point (`index-prod.ts`)

## External Dependencies

### Database
- **Neon PostgreSQL** - Serverless Postgres database
  - Connection via `@neondatabase/serverless` package
  - WebSocket-based connections
  - Environment variable: `DATABASE_URL`

### Bitcoin/Lightning Services
- **LNBits** (Optional) - Self-hosted Lightning wallet
  - User-configured instance URL and admin key
  - REST API for invoice creation and payment verification
  
- **Nostr Relays** - For Nostr Wallet Connect protocol
  - Default relay: `wss://relay.getalby.com/v1`
  - WebSocket connections for payment requests
  - Configurable via NWC connection strings

### UI Component Library
- **Radix UI** - Headless UI primitives
  - All interactive components (dialogs, dropdowns, tabs, etc.)
  - Accessibility-focused components
  
- **shadcn/ui** - Pre-styled Radix components
  - Tailwind CSS styling
  - Customizable design tokens

### Frontend Build Tools
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Type safety across frontend and backend

### Replit-Specific
- **Vite Plugins** - Runtime error modal, cartographer, dev banner
- Custom meta images plugin for OpenGraph tags
- Auto-deployment URL detection

### Session & Storage
- **connect-pg-simple** - PostgreSQL session store for Express
- In-memory storage abstraction layer (`/server/storage.ts`)

### Validation & Type Safety
- **Zod** - Runtime type validation
- **drizzle-zod** - Auto-generate Zod schemas from Drizzle schema
- Shared types between client and server

### Date Handling
- **date-fns** - Date utility library
- **react-day-picker** - Calendar component for event scheduling

## Data Retention & Cleanup Policy

**CRITICAL PRINCIPLE:** Preserve all financial data and performance metrics. Delete only operational/media artifacts.

### ✅ IMMUTABLE DATA (Never Delete)
- **transactions** table - Complete audit trail of all satoshi movements
- **peers.balance** - Historical balance snapshots for wealth tracking
- **Task completion records** - Required for long-term performance analytics
- **Level/XP progression** - Child's learning history must be preserved
- **Allowance payment records** - Complete payment history

### 🗑️ SAFE TO DELETE (Parent-controlled cleanup)
- **Task details/descriptions** - Only if transaction link is preserved
- **Photo proofs** - Storage bloat after task completion approved
- **Chat messages** - Optional cleanup based on parent preference
- **Event details** - After event date has passed
- **Temporary data** - Incomplete/abandoned entries

### ⚠️ DANGEROUS OPERATIONS (Future feature - requires confirmation)
- Never delete tasks with linked transactions
- Never delete user balance records
- Archive instead of delete for compliance
- Always maintain transaction-to-task foreign keys
- Implement soft-delete where possible (add `deletedAt` flag)

### Implementation Notes
- Cleanup functionality should be parent-only in settings
- Require explicit confirmation for destructive operations
- Log all deletions for audit purposes
- Consider data archival instead of permanent deletion for GDPR compliance