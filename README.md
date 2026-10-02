# ⚡ Microtask & Get-Paid-To (GPT) Platform

A full-stack, enterprise-grade Micro-Tasking / Get-Paid-To platform (inspired by **VBoost.ru**, **Picoworkers**, and **SproutGigs**).
Engineered with a **dual-role single-account architecture** (Worker + Advertiser), **atomic financial ledger**, **gamification & streak tracking**, **Cloudinary screenshot proof uploads**, and a **Next.js 14 (App Router) + Tailwind CSS** dashboard.

---

## 🏗️ Tech Stack

- **Backend:** Node.js, Express.js 4, Mongoose 8
- **Database:** MongoDB (Local or MongoDB Atlas cluster)
- **Cloud Storage:** Cloudinary (with automatic fallback to local disk storage via Multer)
- **Security & Integrity:** Helmet, CORS, Express Rate Limiting, bcryptjs, JWT with refresh token rotation, HMAC-SHA256 webhook signatures
- **Frontend:** Next.js 14.2 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons, Axios

---

## 📂 Project Architecture

```
microtask-platform/
├── .env                          # Backend environment configuration
├── package.json                  # Root dependencies & convenience scripts
├── src/
│   ├── server.js                 # Express app entry & HTTP server
│   ├── config/
│   │   ├── database.js           # Mongoose connection & pool config
│   │   ├── cloudinary.js         # Cloudinary SDK & Multer Cloudinary storage
│   │   ├── logger.js             # Winston logger (dev colorized / prod JSON)
│   │   └── seed.js               # Database demo seeder (Admin, Advertiser, Worker)
│   ├── middleware/
│   │   ├── auth.js               # JWT, API Key (X-API-Key), & FlexAuth guards
│   │   └── errorHandler.js       # Central operational error handling
│   ├── models/
│   │   ├── User.js               # Dual balance, XP/Level/Streak, referrals
│   │   ├── Campaign.js           # Tasks across VK, IG, YT, TG, TikTok, Reviews
│   │   ├── Completion.js         # Submission lifecycle (accepted → submitted → approved/rejected)
│   │   ├── Transaction.js        # Immutable double-entry ledger with balance snapshots
│   │   └── ApiKey.js             # SHA-256 hashed API keys for external advertisers
│   ├── routes/
│   │   ├── auth.routes.js        # /api/v1/auth (register, login, refresh, me, api-keys)
│   │   ├── offers.routes.js      # /api/v1/offers (campaign CRUD, pause, cancel + refund)
│   │   ├── completions.routes.js # /api/v1/completions (task accept, upload proof, review)
│   │   ├── webhook.routes.js     # /api/v1/webhooks (HMAC-SHA256 inbound callbacks)
│   │   └── dashboard.routes.js   # /api/v1/dashboard (user stats, leaderboard, ledger)
│   ├── services/
│   │   ├── ledger.service.js     # Atomic Mongoose session-based debit/credit & payout
│   │   ├── reseller.service.js   # Third-party tasks sync (VBoost cold-start fallback)
│   │   └── autoApprove.cron.js   # Background cron jobs (auto-approve, expiration)
│   └── utils/
│       ├── upload.js             # Hybrid storage factory (Cloudinary / Disk)
│       ├── jwt.js                # Token signing & refresh generation
│       ├── webhook.js            # HMAC-SHA256 signature generator & dispatcher
│       ├── asyncHandler.js       # Controller wrapper eliminating try/catch
│       └── errors.js             # Custom AppError classes
└── frontend/                     # Next.js 14 Frontend Application
    ├── .env.local                # Frontend API URL configuration
    ├── next.config.js            # Next.js config with remote image domains
    ├── tailwind.config.js        # Custom brand styling & animations
    └── src/
        ├── app/
        │   ├── (auth)/login      # Login page with password visibility toggle
        │   ├── (auth)/register   # Register page with password strength meter
        │   ├── (dashboard)/worker# Worker Dashboard (stats, XP progress, leaderboard)
        │   │   ├── tasks/        # Task Feed with category filters (VK, IG, YT, TG...)
        │   │   └── history/      # Completed tasks table with dispute filing
        │   └── (dashboard)/advertiser # Advertiser Dashboard
        │       ├── campaigns/    # Campaign manager & modal creation form
        │       └── analytics/    # Proof submission review modal (Approve/Reject)
        ├── components/           # UI components, modals, badges, layout header & sidebar
        ├── context/AuthContext.tsx # Central auth state with Axios interceptors
        └── lib/api.ts            # Typed API client with auto-refresh token logic
```

---

## 🚀 Quickstart Guide

### 1. Configure the Database Password
Open `.env` in the root folder and replace `<db_password>` with your real MongoDB Atlas password:
```env
MONGODB_URI=mongodb+srv://umeralibrand890_db_user:<YOUR_ACTUAL_PASSWORD>@cluster0.titjb21.mongodb.net/microtask_platform?appName=Cluster0
```

*(Optional) Configure Cloudinary if you want cloud uploads:*
```env
USE_CLOUDINARY=true
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```
*Note: If `USE_CLOUDINARY=false` or keys are omitted, uploads automatically save to `./uploads/proofs/`.*

---

### 2. Seed the Database
Populate demo users (Worker, Advertiser, Admin) and sample social media tasks:
```bash
npm run seed
```

---

### 3. Start the Backend API Server
```bash
npm run dev
```
Backend runs on **http://localhost:5000**  
Health Check: **http://localhost:5000/api/health**

---

### 4. Start the Next.js Frontend
In a separate terminal window:
```bash
cd frontend
npm run dev
```
*(Or from the root directory: `npm run client:dev`)*

Frontend runs on **http://localhost:3000**

---

## 🔑 Demo Accounts (Ready to Test)

After running `npm run seed`:

| Role | Email | Password | What You Can Test |
|---|---|---|---|
| **Worker** | `worker@microtask.com` | `Password123!` | Browse tasks, submit screenshot proof, track XP & streaks, view earnings |
| **Advertiser** | `advertiser@microtask.com` | `Password123!` | Create campaigns (15% platform fee calculated live), review proofs, approve/reject |
| **Admin** | `admin@microtask.com` | `Password123!` | Dual role with boosted balance, review all submissions |

---

## 💡 Core Features & Technical Highlights

1. **Dual-Role from Single Account:**
   - Seamlessly toggle between **Worker** and **Advertiser** from the dashboard sidebar.
   - Dual balances tracked separately:
     - **Main Balance**: Worker earnings ready for withdrawal.
     - **Ad Balance**: Prepaid funds locked for ad campaigns.

2. **Atomic Financial Ledger (`ledger.service.js`):**
   - Every balance mutation is executed inside a **Mongoose session** (transaction).
   - Double-entry logging with snapshot balances (`balanceBefore`, `balanceAfter`) guarantees zero discrepancy.

3. **Gamification & Streak Engine:**
   - Level thresholds automatically advance users as they complete tasks.
   - Daily streak tracking with longest streak records.

4. **Multi-Platform Task Engine:**
   - Dedicated task categories for **VKontakte**, **Instagram**, **YouTube**, **TikTok**, **Telegram**, **Facebook**, **X/Twitter**, **Threads**, **App Installs**, and **Reviews**.
   - Supports Screenshot uploads, Username checks, or Text proofs.

5. **Cold-Start Fallback Strategy (`reseller.service.js`):**
   - Background cron worker monitors local active campaign inventory.
   - Automatically synchronizes third-party tasks via reseller APIs (e.g., VBoost) when inventory drops below threshold.
