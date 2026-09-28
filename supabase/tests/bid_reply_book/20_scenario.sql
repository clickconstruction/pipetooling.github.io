-- Who may read, post, change and delete in the Reply book (v2.4025). Raises on the first failed
-- assertion; ends with "bid_reply_book PASSED". Run after 00_schema.sql and the migration.
\set ON_ERROR_STOP 1
DROP SCHEMA IF EXISTS t CASCADE;
CREATE SCHEMA t;
TRUNCATE public.bid_reply_book_entries;
INSERT INTO public.users VALUES ('00000000-0000-0000-0000-000000000006','s@x','Super','superintendent') ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION t.expect_fail(q text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE q; EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%' || want || '%' THEN RAISE EXCEPTION 'wrong failure for [%]: %', q, SQLERRM; END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'expected a failure, got none: %', q;
END $$;
CREATE OR REPLACE FUNCTION t.n(q text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE c bigint; BEGIN EXECUTE q; GET DIAGNOSTICS c = ROW_COUNT; RETURN c; END $$;
GRANT USAGE ON SCHEMA t TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO authenticated;
SET ROLE authenticated;

-- Wendi posts. She names Alex as the author; the server stamps her.
SELECT set_config('bed.uid','00000000-0000-0000-0000-000000000001',false);
INSERT INTO public.bid_reply_book_entries (title, kind, body, created_by, created_by_name, created_at)
VALUES ('  Declining: too far from the office ', 'declining', E'\n We are going to decline to bid on this project.  \n', '00000000-0000-0000-0000-000000000002', 'Somebody Else', '2001-01-01');
DO $$ DECLARE r public.bid_reply_book_entries; BEGIN
  SELECT * INTO r FROM public.bid_reply_book_entries;
  ASSERT r.created_by = '00000000-0000-0000-0000-000000000001', 'author is the poster';
  ASSERT r.created_by_name = 'Wendi', 'name from users: ' || r.created_by_name;
  ASSERT r.created_at > now() - interval '1 minute', 'created_at is the server''s';
  ASSERT r.title = 'Declining: too far from the office', 'title trimmed';
  ASSERT r.body = 'We are going to decline to bid on this project.', 'body trimmed: [' || r.body || ']';
  ASSERT r.sign_with_sender, 'signs by default';
  ASSERT r.updated_by = r.created_by, 'updated_by starts as the author';
END $$;
SELECT t.expect_fail($q$INSERT INTO public.bid_reply_book_entries (title, kind, body, created_by) VALUES ('   ', 'other', 'x', auth.uid())$q$, 'check constraint');
SELECT t.expect_fail($q$INSERT INTO public.bid_reply_book_entries (title, kind, body, created_by) VALUES ('t', 'nonsense', 'x', auth.uid())$q$, 'check constraint');
SELECT t.expect_fail($q$INSERT INTO public.bid_reply_book_entries (title, kind, body, created_by) VALUES ('t', 'other', repeat('x', 4001), auth.uid())$q$, 'check constraint');
SELECT t.expect_fail($q$INSERT INTO public.bid_reply_book_entries (title, kind, body, created_by) VALUES (repeat('t', 121), 'other', 'x', auth.uid())$q$, 'check constraint');

-- Alex reads it, and can neither change nor delete it.
SELECT set_config('bed.uid','00000000-0000-0000-0000-000000000002',false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.bid_reply_book_entries) = 1, 'Alex reads';
  ASSERT t.n($q$UPDATE public.bid_reply_book_entries SET title = 'mine now'$q$) = 0, 'Alex cannot change Wendi''s';
  ASSERT t.n($q$DELETE FROM public.bid_reply_book_entries$q$) = 0, 'Alex cannot delete Wendi''s';
END $$;

-- Wendi changes hers; the author and the posting time stay.
SELECT set_config('bed.uid','00000000-0000-0000-0000-000000000001',false);
DO $$ DECLARE r public.bid_reply_book_entries; BEGIN
  ASSERT t.n($q$UPDATE public.bid_reply_book_entries SET title = 'Declining: too far', created_by = '00000000-0000-0000-0000-000000000002', created_by_name = 'Alex', created_at = '2001-01-01', sign_with_sender = false$q$) = 1, 'Wendi changes hers';
  SELECT * INTO r FROM public.bid_reply_book_entries;
  ASSERT r.title = 'Declining: too far' AND NOT r.sign_with_sender, 'the change landed';
  ASSERT r.created_by = '00000000-0000-0000-0000-000000000001' AND r.created_by_name = 'Wendi', 'author kept';
  ASSERT r.created_at > now() - interval '1 minute', 'posting time kept';
END $$;

-- Helpers do not open Bids: nothing to read, nothing to post.
SELECT set_config('bed.uid','00000000-0000-0000-0000-000000000004',false);
DO $$ BEGIN ASSERT (SELECT count(*) FROM public.bid_reply_book_entries) = 0, 'helper reads nothing'; END $$;
SELECT t.expect_fail($q$INSERT INTO public.bid_reply_book_entries (title, kind, body, created_by) VALUES ('t', 'other', 'x', auth.uid())$q$, 'row-level security');

-- Nobody signed in.
SELECT set_config('bed.uid','',false);
DO $$ BEGIN ASSERT (SELECT count(*) FROM public.bid_reply_book_entries) = 0, 'no user reads nothing'; END $$;
SELECT t.expect_fail($q$INSERT INTO public.bid_reply_book_entries (title, kind, body) VALUES ('t', 'other', 'x')$q$, 'row-level security');

-- Primary, superintendent and controller read and post.
SELECT set_config('bed.uid','00000000-0000-0000-0000-000000000005',false);
INSERT INTO public.bid_reply_book_entries (title, kind, body, created_by) VALUES ('From a primary', 'other', 'x', auth.uid());
SELECT set_config('bed.uid','00000000-0000-0000-0000-000000000006',false);
INSERT INTO public.bid_reply_book_entries (title, kind, body, created_by) VALUES ('From a superintendent', 'asking', 'x', auth.uid());
SELECT set_config('bed.uid','00000000-0000-0000-0000-000000000007',false);
INSERT INTO public.bid_reply_book_entries (title, kind, body, created_by) VALUES ('From a controller', 'following_up', 'x', auth.uid());
DO $$ BEGIN ASSERT (SELECT count(*) FROM public.bid_reply_book_entries) = 4, 'controller reads all four'; END $$;

-- A dev changes and deletes anybody's; the author stays the author.
SELECT set_config('bed.uid','00000000-0000-0000-0000-000000000003',false);
DO $$ DECLARE r public.bid_reply_book_entries; BEGIN
  ASSERT t.n($q$UPDATE public.bid_reply_book_entries SET body = 'fixed a typo' WHERE title = 'Declining: too far'$q$) = 1, 'dev changes Wendi''s';
  SELECT * INTO r FROM public.bid_reply_book_entries WHERE title = 'Declining: too far';
  ASSERT r.created_by = '00000000-0000-0000-0000-000000000001' AND r.updated_by = '00000000-0000-0000-0000-000000000003', 'author kept, editor recorded';
  ASSERT t.n($q$DELETE FROM public.bid_reply_book_entries WHERE title = 'From a primary'$q$) = 1, 'dev deletes';
END $$;

-- Wendi deletes her own.
SELECT set_config('bed.uid','00000000-0000-0000-0000-000000000001',false);
DO $$ BEGIN
  ASSERT t.n($q$DELETE FROM public.bid_reply_book_entries$q$) = 1, 'Wendi deletes hers and only hers';
  ASSERT (SELECT count(*) FROM public.bid_reply_book_entries) = 2, 'two left';
END $$;

-- An account that is removed leaves its replies, with the name they were posted under.
RESET ROLE;
CREATE TEMP TABLE before_removal AS SELECT * FROM public.bid_reply_book_entries WHERE title = 'From a superintendent';
SELECT pg_sleep(0.05);
DELETE FROM public.users WHERE id = '00000000-0000-0000-0000-000000000006';
DO $$ DECLARE r public.bid_reply_book_entries; b before_removal; BEGIN
  SELECT * INTO r FROM public.bid_reply_book_entries WHERE title = 'From a superintendent';
  SELECT * INTO b FROM before_removal;
  ASSERT r.created_by IS NULL AND r.created_by_name = 'Super', 'the reply outlives the account';
  ASSERT r.updated_by IS NULL, 'the editor is cleared with the account';
  ASSERT r.updated_at = b.updated_at, 'an account removal is not an edit';
END $$;
-- A save that changes nothing is not an edit either; one that changes the wording is.
SET ROLE authenticated;
SELECT set_config('bed.uid','00000000-0000-0000-0000-000000000007',false);
DO $$ DECLARE a timestamptz; b timestamptz; BEGIN
  SELECT updated_at INTO a FROM public.bid_reply_book_entries WHERE title = 'From a controller';
  PERFORM pg_sleep(0.05);
  UPDATE public.bid_reply_book_entries SET body = '  x  ' WHERE title = 'From a controller';
  SELECT updated_at INTO b FROM public.bid_reply_book_entries WHERE title = 'From a controller';
  ASSERT a = b, 'same wording after the trim: not an edit';
END $$;
DO $$ DECLARE a timestamptz; b timestamptz; BEGIN
  SELECT updated_at INTO a FROM public.bid_reply_book_entries WHERE title = 'From a controller';
  UPDATE public.bid_reply_book_entries SET body = 'y' WHERE title = 'From a controller';
  SELECT updated_at INTO b FROM public.bid_reply_book_entries WHERE title = 'From a controller';
  ASSERT b > a, 'new wording: an edit';
END $$;
RESET ROLE;
DO $$ BEGIN RAISE NOTICE 'bid_reply_book PASSED'; END $$;
