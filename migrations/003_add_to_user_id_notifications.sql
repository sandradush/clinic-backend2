-- Ensure notifications.to_user_id exists (id or role sentinel)
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS to_user_id TEXT;

-- Optionally, you may want to backfill role-based rows or convert old data here.
