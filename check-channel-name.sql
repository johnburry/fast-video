-- Check the channel_name for urban-living channel
SELECT id, channel_name, channel_handle, youtube_channel_id
FROM channels
WHERE channel_handle = 'urban-living';

-- Also check what's in mux_videos
SELECT mv.mux_playback_id, mv.channel_id, c.channel_name, c.channel_handle
FROM mux_videos mv
LEFT JOIN channels c ON mv.channel_id = c.id
ORDER BY mv.created_at DESC
LIMIT 5;
