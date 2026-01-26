# AI-Powered Video Quotes Feature

## Overview
This feature adds AI-generated "powerful quotes" to video player modals. When a user clicks on a video in the channel gallery, the video player popup will display 10 of the most powerful and impactful quotes from that video's transcript below the player.

## Features
- **AI Analysis**: Uses OpenAI's GPT-4 to analyze full video transcripts and extract the 10 most powerful, memorable quotes
- **Caching**: Quotes are stored in the database after generation, so they don't consume AI credits on subsequent views
- **Interactive**: Each quote is clickable with "Play from here" functionality that seeks the video to that timestamp
- **Shareable**: Each quote has a "Share" button that copies a YouTube URL with timestamp to the clipboard
- **Visual Design**: Quotes are displayed in a responsive 2-column grid below the video player using the same design language as search results

## Implementation

### Database Schema
New table: `video_quotes`
```sql
- id (uuid, primary key)
- video_id (uuid, foreign key to videos table)
- quote_text (text)
- start_time (numeric, in seconds)
- duration (numeric, in seconds)
- quote_index (integer, 1-10, the rank/position)
- created_at, updated_at (timestamps)
```

### API Endpoint
**GET** `/api/videos/[videoId]/quotes`

**Behavior:**
1. Checks if quotes already exist in the database for this video
2. If yes: Returns cached quotes immediately
3. If no:
   - Fetches all transcript segments for the video
   - Sends full transcript to OpenAI GPT-4 with a specialized prompt
   - Parses the AI response to extract 10 quotes with timestamps
   - Matches quotes to transcript segments for precise timing
   - Stores quotes in the database
   - Returns the generated quotes

**Response:**
```json
{
  "quotes": [
    {
      "text": "The quote text",
      "startTime": 125.5,
      "duration": 3.2,
      "index": 1
    },
    ...
  ],
  "cached": true
}
```

### UI Components
**Location:** Video Player Modal in `/app/[channelHandle]/page.tsx`

**Display:**
- Shows below the video player in the modal
- Loading spinner with message: "Analyzing video transcript for powerful quotes..."
- Error message if quote generation fails
- 2-column responsive grid of quote cards

**Quote Card:**
- Numbered badge (1-10)
- Quote text
- Timestamp display
- YouTube play icon with "Play from here" text
- "Share" button

### User Interactions
1. **Click on Quote Card**: Reloads the YouTube iframe at that quote's timestamp with autoplay
2. **Click "Share" Button**: Copies YouTube URL with timestamp to clipboard

## Deployment

### Database Migration
Run the migration file to create the `video_quotes` table:
```bash
# Using Supabase CLI
supabase db push

# OR manually run the SQL in Supabase Dashboard
# File: supabase/migrations/20260126_add_video_quotes.sql
```

### Environment Variables
The feature uses the existing `OPENAI_API_KEY` environment variable that's already configured for semantic search.

### Files Modified/Created
1. **Created:**
   - `/supabase/migrations/20260126_add_video_quotes.sql` - Database schema
   - `/app/api/videos/[videoId]/quotes/route.ts` - API endpoint for quote generation

2. **Modified:**
   - `/app/[channelHandle]/page.tsx` - Added quotes display UI and state management

## Testing
1. Navigate to a channel page (e.g., `http://localhost:3000` or subdomain)
2. Click on any video from the gallery
3. The video player modal should open
4. Below the video player, you should see a loading message
5. After ~5-15 seconds (first time only), 10 quote cards should appear
6. Click on a quote card to jump to that timestamp
7. Click "Share" to copy the YouTube link with timestamp
8. Close and reopen the same video - quotes should load instantly from cache

## AI Prompt
The system uses a carefully crafted prompt that instructs GPT-4 to:
- Identify emotionally impactful or intellectually profound statements
- Ensure quotes are self-contained and understandable on their own
- Select memorable and shareable content
- Keep quotes between 10-100 words
- Return exactly 10 quotes in JSON format with text and timestamp

## Cost Considerations
- **First View**: Uses OpenAI GPT-4 API (costs ~$0.01-0.05 per video depending on transcript length)
- **Subsequent Views**: Free (loaded from database cache)
- The feature is designed to minimize costs by caching all generated quotes permanently

## Future Enhancements
Potential improvements for future iterations:
- Regenerate quotes button for admin users
- Quote categorization (inspirational, educational, humorous, etc.)
- Social sharing cards with quote images
- Analytics on which quotes are most clicked/shared
- Manual quote editing/curation interface
