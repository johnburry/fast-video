-- Add subscription tracking fields to channels table
ALTER TABLE channels
ADD COLUMN subscription_type TEXT DEFAULT 'trial',
ADD COLUMN subscription_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN channel_history TEXT;

-- Update existing channels with trial subscription and initial history
UPDATE channels
SET
  subscription_type = 'trial',
  channel_history = 'Channel created: ' || TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS')
WHERE subscription_type IS NULL OR channel_history IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN channels.subscription_type IS 'Type of subscription: trial, intro, pro, or lifetime';
COMMENT ON COLUMN channels.subscription_start_date IS 'Date when the current subscription started';
COMMENT ON COLUMN channels.channel_history IS 'Log of all changes to subscription type, status, and other important fields';
