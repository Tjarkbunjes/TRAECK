-- Migration: Split nickname into per-user nicknames
-- The old 'nickname' column was shared between both users in a friendship.
-- Now each user gets their own nickname column for the friend.

-- Add new columns
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS requester_nickname text;
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS addressee_nickname text;

-- Migrate existing nicknames to requester_nickname (the requester set them)
UPDATE friendships SET requester_nickname = nickname WHERE nickname IS NOT NULL;

-- Drop old column
ALTER TABLE friendships DROP COLUMN IF EXISTS nickname;
