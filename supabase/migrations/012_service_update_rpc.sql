-- Migration 012: Server-side update RPC function
-- ============================================
-- PROBLEM: PostgREST schema cache rejects UPDATE operations even after
-- GRANT ALL and explicit RLS policies. Direct .update() calls via the
-- Supabase client fail with "cannot update table".
--
-- FIX: Create a SECURITY DEFINER function that performs updates via
-- dynamic SQL, completely bypassing PostgREST table operation restrictions.
-- The function validates table names against a strict whitelist and uses
-- %I/%L format specifiers to prevent SQL injection.
-- ============================================

CREATE OR REPLACE FUNCTION public.service_update(
  p_table_name TEXT,
  p_set_data JSONB,
  p_where_conditions JSONB
) RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed_tables CONSTANT TEXT[] := ARRAY[
    'participants', 'participant_photos', 'conversations',
    'messages', 'likes', 'events', 'banned_devices',
    'event_analytics_snapshots', 'push_subscriptions'
  ];
  sql TEXT;
  set_parts TEXT[] := '{}';
  where_parts TEXT[] := '{}';
  k TEXT;
BEGIN
  -- Validate table name against whitelist (prevents SQL injection)
  IF NOT (p_table_name = ANY(allowed_tables)) THEN
    RAISE EXCEPTION 'Table "%" is not allowed', p_table_name;
  END IF;

  -- Build SET clause from JSONB keys/values
  FOR k IN SELECT jsonb_object_keys(p_set_data)
  LOOP
    IF jsonb_typeof(p_set_data->k) = 'null' THEN
      set_parts := array_append(set_parts, format('%I = NULL', k));
    ELSE
      set_parts := array_append(set_parts, format('%I = %L', k, p_set_data->>k));
    END IF;
  END LOOP;

  IF array_length(set_parts, 1) IS NULL THEN
    RAISE EXCEPTION 'No fields to update';
  END IF;

  -- Build WHERE clause from JSONB keys/values
  FOR k IN SELECT jsonb_object_keys(p_where_conditions)
  LOOP
    IF jsonb_typeof(p_where_conditions->k) = 'null' THEN
      where_parts := array_append(where_parts, format('%I IS NULL', k));
    ELSE
      where_parts := array_append(where_parts, format('%I = %L', k, p_where_conditions->>k));
    END IF;
  END LOOP;

  IF array_length(where_parts, 1) IS NULL THEN
    RAISE EXCEPTION 'WHERE clause is required';
  END IF;

  -- Execute the dynamic UPDATE
  sql := 'UPDATE ' || format('%I', p_table_name) ||
         ' SET ' || array_to_string(set_parts, ', ') ||
         ' WHERE ' || array_to_string(where_parts, ' AND ') ||
         ' RETURNING to_jsonb(' || format('%I', p_table_name) || '.*)';

  RETURN QUERY EXECUTE sql;
END;
$$;

-- Restrict access: only service_role can call this function
REVOKE EXECUTE ON FUNCTION public.service_update(TEXT, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_update(TEXT, JSONB, JSONB) TO service_role;

-- Force PostgREST to reload and pick up the new function
NOTIFY pgrst, 'reload schema';
