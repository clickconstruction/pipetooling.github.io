SET lock_timeout = '3s';

-- Mark sent, any channel (v2.2761): a statement often goes out by text, a
-- call, or in person rather than the personal email the round assumes. The
-- round mark now records HOW it went out and an optional note, alongside the
-- who/when it already keeps — one row per (week, GC) stays the ledger, and
-- past weeks' rows are the send history shown behind the last-sent pill.
--
-- Additive and idempotent; no new table, so the read-only policy re-apply
-- calls are not needed. Existing rows read as channel NULL = email.

alter table public.gc_statement_round_marks
  add column if not exists channel text,
  add column if not exists note text;

alter table public.gc_statement_round_marks
  drop constraint if exists gc_statement_round_marks_channel_check;
alter table public.gc_statement_round_marks
  add constraint gc_statement_round_marks_channel_check
  check (channel is null or channel in ('email', 'text', 'call', 'in_person', 'other'));

comment on column public.gc_statement_round_marks.channel is
  'How the statement went out (v2.2761): email | text | call | in_person | other. NULL on rows from before the column existed — those were personal emails.';
comment on column public.gc_statement_round_marks.note is
  'Optional free-text note from whoever marked it sent (v2.2761) — what was said, what the GC promised. Kept for posterity with acted_by/acted_at.';
