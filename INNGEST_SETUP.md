# Inngest Setup Guide

## What's Complete

✅ Installed Inngest SDK
✅ Created Inngest client (`lib/inngest/client.ts`)
✅ Created database migration for job tracking (`supabase/migrations/20260210_create_channel_import_jobs.sql`)
✅ Created shared import logic (`lib/import/channelImport.ts`)
✅ Created Inngest function (`inngest/functions.ts`)
✅ Created Inngest serve endpoint (`/api/inngest`)
✅ Created trigger API (`/api/admin/channels/[id]/import`)
✅ Created status/cancel APIs (`/api/admin/channels/[id]/import/status`)

## Remaining Tasks

### 1. Run Database Migration

Run this in Supabase SQL Editor:
```bash
# Copy the contents of supabase/migrations/20260210_create_channel_import_jobs.sql
# and paste into Supabase SQL Editor
```

### 2. Sign Up for Inngest

1. Go to https://www.inngest.com/
2. Sign up for free account (50k function runs/month free)
3. Create a new app
4. Get your signing key and event key

### 3. Add Environment Variables

Add to `.env.local`:
```bash
INNGEST_SIGNING_KEY=your_signing_key_here
INNGEST_EVENT_KEY=your_event_key_here
```

### 4. Update Manage Channel Page UI

Need to add import status widget to `/app/admin/manage/[id]/page.tsx`:

1. Add state for import status
2. Add polling effect to check status every 5 seconds
3. Add UI component to show:
   - "Start Background Import" button
   - Progress bar when import is running
   - Current video being processed
   - Videos processed count (X / Y)
   - Transcripts downloaded count
   - Cancel button
4. Replace the "Import Channel" link with "Start Background Import" button

### 5. Test Locally

```bash
# Terminal 1: Start Next.js
npm run dev

# Terminal 2: Start Inngest Dev Server
npx inngest-cli@latest dev

# Navigate to http://localhost:3000/admin/manage/[channel-id]
# Click "Start Background Import"
# Check Inngest dev server UI at http://localhost:8288
```

### 6. Deploy to Production

1. Push code to GitHub
2. Deploy to Vercel
3. In Inngest dashboard:
   - Add your production URL (`https://your-app.vercel.app/api/inngest`)
   - Configure sync
4. Test import with small channel first

## How It Works

1. User clicks "Start Background Import" on manage channel page
2. Frontend calls `POST /api/admin/channels/[id]/import`
3. API creates job record in database with status='pending'
4. API sends event to Inngest
5. Inngest picks up event and runs `importChannelJob` function
6. Function updates job status to 'running' and processes all videos
7. Progress is written to database in real-time
8. Frontend polls `/api/admin/channels/[id]/import/status` every 5 seconds
9. User sees live progress updates
10. When complete, job status = 'completed'

## Benefits

- ✅ No timeouts - can import 2,000+ videos without restarting
- ✅ No browser needed - close browser, import continues
- ✅ Real-time progress - see which video is being processed
- ✅ Automatic retries - Inngest retries on failure
- ✅ Concurrent imports - multiple channels can import at once
- ✅ No interference with existing cron jobs

## Troubleshooting

**Import not starting:**
- Check Inngest dev server is running (`npx inngest-cli dev`)
- Check environment variables are set
- Check browser console for API errors

**Import stuck:**
- Check Inngest dashboard for function errors
- Check Supabase logs
- Query `channel_import_jobs` table to see job status

**Can't cancel:**
- Cancellation marks job as failed in database
- Inngest function will check status before each update
- May take a few seconds to fully stop

## Next Steps

After completing setup, consider adding:
- Email notifications when import completes
- Webhook to notify on completion
- Batch import multiple channels
- Schedule automatic re-imports
