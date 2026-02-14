-- Migration 007: Hardware fingerprinting for robust ban enforcement
--
-- Adds a hardware_fingerprint column to participants table
-- to track canvas/WebGL/screen-based device identity that persists
-- across incognito sessions and localStorage clears.
--
-- The banned_devices table now stores both types of fingerprints.

-- Add hardware fingerprint column to participants
ALTER TABLE participants ADD COLUMN IF NOT EXISTS hardware_fingerprint TEXT;

-- Create index for hardware fingerprint lookups
CREATE INDEX IF NOT EXISTS idx_participants_hw_fingerprint 
  ON participants(event_id, hardware_fingerprint) 
  WHERE hardware_fingerprint IS NOT NULL;

-- Create index on banned_devices for hardware fingerprint lookups
CREATE INDEX IF NOT EXISTS idx_banned_devices_hw 
  ON banned_devices(event_id, device_fingerprint);
