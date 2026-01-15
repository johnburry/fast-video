# PlaySermons.com Setup Guide

Complete guide to get PlaySermons.com up and running.

## Prerequisites

- Node.js 18+ and pnpm installed
- A Supabase account (free tier is fine)
- A Vercel account for deployment (optional, but recommended)

## Step 1: Clone and Install

```bash
git clone <your-repo>
cd fast-video
pnpm install
```

## Step 2: Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the database to be provisioned (2-3 minutes)
3. Go to the SQL Editor in your Supabase dashboard
4. Copy the contents of `supabase/schema.sql`
5. Paste and run it in the SQL Editor
6. Verify that the tables were created by going to the Table Editor

## Step 3: Get Supabase Credentials

1. In your Supabase project, go to **Project Settings** → **API**
2. Copy the following values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public key** (under "Project API keys")
   - **service_role key** (under "Project API keys" - keep this secret!)

## Step 4: Configure Environment Variables

1. Copy the example environment file:
```bash
cp .env.local.example .env.local
```

2. Edit `.env.local` and add your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## Step 5: Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Step 6: Import Your First Channel

1. Navigate to [http://localhost:3000/admin](http://localhost:3000/admin)
2. Enter a YouTube channel handle (e.g., `@mkbhd`, `@veritasium`)
3. Click "Import Channel"
4. Wait for the import to complete (this may take 5-15 minutes depending on channel size)
5. Once complete, click the link to view the channel's PlaySermons.com page

## Step 7: Search and Test

1. Go to the channel page (e.g., `http://localhost:3000/mkbhd`)
2. Try searching for keywords that appear in the videos
3. Click on search results to jump to that moment in the video

## Deployment to Vercel

### Quick Deploy

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Add New Project"
4. Import your GitHub repository
5. Add the environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
6. Click "Deploy"

### Via Vercel CLI

```bash
# Install Vercel CLI
pnpm i -g vercel

# Login
vercel login

# Deploy
vercel

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Deploy to production
vercel --prod
```

## Common Issues and Solutions

### "Channel not found" error

- Make sure the channel handle starts with `@`
- Some channels may not have transcripts available
- The channel must be public

### Import is very slow

- Large channels with 100+ videos can take 15-30 minutes
- The process downloads and processes each video's transcript
- Keep the browser tab open during import

### "No transcripts available" for some videos

- Not all YouTube videos have captions/transcripts
- Auto-generated captions must be enabled by the creator
- Live streams may not have transcripts immediately after airing

### Environment variables not working

- Make sure `.env.local` is in the root directory
- Restart the dev server after changing environment variables
- Double-check there are no extra spaces in the values

## Next Steps

Once you have the basic setup working:

1. **Customize the design** - Edit the Tailwind classes in the page components
2. **Add authentication** - Restrict the admin page to authorized users
3. **Set up automatic syncing** - Create a cron job to periodically re-import channels
4. **Add analytics** - Track which searches are most popular
5. **Optimize search** - Tune the PostgreSQL full-text search configuration

## Support

For issues, please check:
- The main [README.md](README.md)
- [GitHub Issues](your-repo/issues)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)

## Architecture Overview

```
┌─────────────────┐
│   User Browser  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Next.js App   │  ← Vercel
│  (App Router)   │
└────────┬────────┘
         │
         ├──────────────┐
         │              │
         ▼              ▼
┌─────────────────┐  ┌──────────────────┐
│   Supabase DB   │  │  YouTube APIs    │
│  (PostgreSQL)   │  │  (youtubei.js)   │
└─────────────────┘  └──────────────────┘
```

### Data Flow for Import

1. User enters channel handle in admin page
2. Next.js API route fetches channel info from YouTube
3. API route fetches all videos from the channel
4. For each video, the transcript is downloaded
5. Channel, videos, and transcripts are stored in Supabase
6. PostgreSQL full-text indexes are automatically updated

### Data Flow for Search

1. User enters search query on channel page
2. Search API route queries Supabase using PostgreSQL full-text search
3. Results are grouped by video
4. Frontend displays results with timestamps
5. Clicking a result opens YouTube embed at that timestamp
