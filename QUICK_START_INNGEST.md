# Quick Start: Testing Background Imports Locally

## The Problem You're Seeing

You clicked "Start Background Import" and see "Waiting to start..." that never changes.

**Why:** The Inngest dev server isn't running, so no worker is picking up the background job.

## Solution: Start Inngest Dev Server

### Step 1: Run the migration

First, run this in Supabase SQL Editor:

```sql
-- Copy and paste the entire contents of:
-- supabase/migrations/20260210_create_channel_import_jobs.sql
```

### Step 2: Start Inngest Dev Server

Open a **new terminal window** and run:

```bash
npx inngest-cli@latest dev
```

You should see:
```
✓ Inngest dev server running at http://localhost:8288
✓ Serving functions from http://localhost:3000/api/inngest
```

**Keep this terminal running!** This is the worker that processes background jobs.

### Step 3: Start Your Next.js App (if not already running)

In another terminal:

```bash
npm run dev
```

### Step 4: Test It

1. Go to http://localhost:3000/admin/manage/[your-channel-id]
2. Click "Start Background Import"
3. Enter number of videos (try 5 for testing)
4. Watch the status widget update in real-time!

### Step 5: Monitor Progress

- **App UI**: http://localhost:3000/admin/manage/[channel-id] - Auto-refreshes every 5 seconds
- **Inngest Dashboard**: http://localhost:8288 - See function execution logs

## What You Should See

1. Button click → "Starting..."
2. Status widget appears → "Waiting to start..."
3. **Within 1-2 seconds** → "Import in progress"
4. Progress bar updates as videos are processed
5. Current video title shows
6. Transcripts count increases
7. Eventually → "Import completed successfully!"

## Troubleshooting

### Still stuck on "Waiting to start..."?

Check the Inngest dev server terminal - you should see:
```
[import-channel] Event received
[import-channel] Function started
```

If you don't see this:

1. **Check the Inngest endpoint is registered**:
   - Visit http://localhost:8288
   - You should see "import-channel" function listed
   - If not, restart both Next.js and Inngest dev server

2. **Check for errors in browser console**:
   - Open DevTools (F12)
   - Look for errors when clicking the button

3. **Check the database**:
   ```sql
   SELECT * FROM channel_import_jobs ORDER BY created_at DESC LIMIT 5;
   ```
   - You should see a record with status='pending'

### Import is running but no progress updates?

Check Next.js terminal for errors. The import function writes progress to the database.

## When You're Ready for Production

1. Sign up at https://www.inngest.com
2. Get your signing key and event key
3. Add to `.env.local`:
   ```
   INNGEST_SIGNING_KEY=your_key
   INNGEST_EVENT_KEY=your_key
   ```
4. Deploy to Vercel
5. In Inngest dashboard, add your production URL
6. Done! No need to run the dev server in production.

## Common Questions

**Q: Do I need to keep the Inngest dev server running?**
A: Yes, for local development. In production, Inngest's cloud service handles it.

**Q: Can I close my browser while importing?**
A: Yes! The import continues in the background. Come back anytime to check progress.

**Q: What if I restart my computer?**
A: The job will be stuck. You'll need to cancel it (click Cancel button) and restart.

**Q: Can I import multiple channels at once?**
A: Yes! Each channel gets its own background job. They run concurrently.
