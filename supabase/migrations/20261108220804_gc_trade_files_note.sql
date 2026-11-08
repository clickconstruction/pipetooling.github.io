SET lock_timeout = '3s';

-- Punch list #205, row 3 (PR 4, v2.6746): a trade partner company sends the office a file that belongs to no record from its
-- portal (Send Click a file: a photo or a ticket with a one-line note). The file lands in the job's Drive folder under
-- Team only → From trades → the company, and its gc_trade_files row carries purpose 'note', so the company's own list of
-- what it sent us (Your files on this job) names it. The P5b migration's way: drop, add NOT VALID, validate, so the check
-- never scans the table under a lock. Nothing else: no table, so no fence calls.
-- Doc: docs/migrations/20261108220804_gc_trade_files_note.md.

ALTER TABLE public.gc_trade_files DROP CONSTRAINT IF EXISTS gc_trade_files_purpose_known;
ALTER TABLE public.gc_trade_files ADD CONSTRAINT gc_trade_files_purpose_known
  CHECK (purpose IN ('submittal', 'change', 'quote', 'waiver', 'coi', 'note')) NOT VALID;
ALTER TABLE public.gc_trade_files VALIDATE CONSTRAINT gc_trade_files_purpose_known;
