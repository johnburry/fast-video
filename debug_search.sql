-- Check if video exists in database
SELECT id, title, youtube_video_id, has_transcript
FROM videos
WHERE id = '2d4c7e62-61ff-4132-b787-979455148468';

-- Check if transcripts exist for this video
SELECT COUNT(*) as transcript_count,
       STRING_AGG(text, ' ') as full_text
FROM transcripts
WHERE video_id = '2d4c7e62-61ff-4132-b787-979455148468';

-- Check if video is in search index
SELECT COUNT(*) as search_context_count
FROM transcript_search_context
WHERE video_id = '2d4c7e62-61ff-4132-b787-979455148468';

-- Test search for "proclaiming"
SELECT video_id, video_title, original_text
FROM transcript_search_context
WHERE video_id = '2d4c7e62-61ff-4132-b787-979455148468'
  AND search_text @@ to_tsquery('english', 'proclaiming');

-- Test if "proclaiming" appears in any transcript for this video
SELECT text
FROM transcripts
WHERE video_id = '2d4c7e62-61ff-4132-b787-979455148468'
  AND LOWER(text) LIKE '%proclaiming%';
