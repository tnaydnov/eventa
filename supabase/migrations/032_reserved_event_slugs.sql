-- Migration 032: enforce reserved event slug blacklist at DB layer
-- Defense-in-depth: API checks already exist, this prevents accidental bypasses.

DO $$
DECLARE
  reserved_slugs TEXT[] := ARRAY[
    'order', 'admin', 'how-it-works', 'pricing', 'faq', 'privacy', 'terms',
    'cookies', 'accessibility', 'guest-upload', 'portal', 'api', 'event-over',
    'dating', 'sitemap', 'sitemap.xml', 'robots.txt', 'manifest.json', 'sw.js',
    'he', 'en', 'ar', 'ru', 'fr', 'es', 'de', 'pt', 'static', 'public',
    'favicon.ico', '_next', '__nextjs', 'health', 'ping', 'status'
  ];
  conflicting_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO conflicting_count
  FROM events
  WHERE lower(slug) = ANY(reserved_slugs);

  IF conflicting_count > 0 THEN
    RAISE EXCEPTION 'Cannot add reserved slug constraint: % existing events use reserved slugs', conflicting_count;
  END IF;
END $$;

ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_slug_reserved_check;

ALTER TABLE events
  ADD CONSTRAINT events_slug_reserved_check
  CHECK (
    lower(slug) <> ALL (
      ARRAY[
        'order', 'admin', 'how-it-works', 'pricing', 'faq', 'privacy', 'terms',
        'cookies', 'accessibility', 'guest-upload', 'portal', 'api', 'event-over',
        'dating', 'sitemap', 'sitemap.xml', 'robots.txt', 'manifest.json', 'sw.js',
        'he', 'en', 'ar', 'ru', 'fr', 'es', 'de', 'pt', 'static', 'public',
        'favicon.ico', '_next', '__nextjs', 'health', 'ping', 'status'
      ]
    )
  );
