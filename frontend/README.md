# ReachInbox Email Scheduler - Modern Frontend

High-performance, production-grade Next.js 14 App Router + Tailwind CSS frontend for orchestrating bulk email campaigns with BullMQ queues, per-sender rate limiting, Ethereal previewing, and Slack telemetry.

## 🚀 Key Features

1. **Dashboard & Analytics**:
   - Real-time counters: Scheduled Queue, Sent Today, Failed / Retrying, Rate Limiter quota (Leaky bucket / sliding window), Worker status.
   - Live synchronization and automatic polling.

2. **Campaign Composer**:
   - CSV / TXT drag-and-drop parsing and manual comma/newline lead ingestion.
   - Instant email regex validation and badge count.
   - Per-email delay configuration (e.g. 2s, 5s) to avoid burst detection.
   - Hourly sender limits (e.g. 50, 100, 200/hr) to guarantee mailbox safety.
   - Immediate dispatch or custom datetime scheduling.

3. **Scheduled & Sent Tabs**:
   - Filterable by recipient email and subject.
   - Scheduled table: status badges (Scheduled, Rescheduled due to rate limits, Pending) with detailed modal and cancellation actions.
   - Sent table: status badges (Delivered, Failed) with direct clickable **"View Preview"** buttons to inspect the rendered HTML in Ethereal Email sandbox.

4. **Authentication & Reviewer Convenience**:
   - Google OAuth 2.0 integration.
   - **One-Click Dev Evaluation Login**: Evaluators and reviewers can instantly enter and test all features without needing Google Cloud credentials configured.

5. **Bull-Board & Slack Telemetry**:
   - Quick header link to `/admin/queues` for live Redis queue observability.
   - Slack connection status and channel display.

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS, Tailwind Merge, Clsx, Lucide Icons
- **HTTP Client**: Axios with credentials enabled
- **Dates**: date-fns
- **Language**: TypeScript (strict mode)

## 🏃 Getting Started

```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Run the development server
npm run dev

# 3. Open in browser
http://localhost:3000
```
