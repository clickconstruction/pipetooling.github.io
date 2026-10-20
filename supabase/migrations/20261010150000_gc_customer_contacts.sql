SET lock_timeout = '3s';

-- GC mode, the Board's B2b-v-i (call E2; to-dos/gc-mode/mockups/board-b2b.md on branch spike/gc-mode): a customer's
-- call log, after the trade partners' (gc_company_contacts, 20261008020000). The customer window's Activity logs a
-- call, a text, an email or a note with a customer (the design spike's logCustomerContact), and the board reads them
-- into GcCustomer.contacts, which Activity and the schedule's call list read. A line may name the job it was about.
--
--   * The office team's (gc_office_team()), under one policy as door 2 gave the trades' log.
--   * Append only: no update, delete or truncate. A line goes with its customer by cascade, as the owner.
--   * Who logged it is the signed-in user (by_user_id takes auth.uid() and is not granted to insert), and the day it
--     went in is the clock's (created_at). by_name is the name the line shows, as the trades' log keeps it.
-- The client starts writing with B2b-v-ii, after the types. No function, no other table changed.

CREATE TABLE IF NOT EXISTS public.gc_customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  -- The job it was about, when it was about one.
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  contacted_on date NOT NULL DEFAULT public.app_today(),
  by_user_id uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '',
  how text NOT NULL
    CONSTRAINT gc_customer_contacts_how_known CHECK (how IN ('call', 'text', 'email', 'note')),
  note text NOT NULL
    CONSTRAINT gc_customer_contacts_note_said CHECK (length(btrim(note)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE public.gc_customer_contacts IS
  'GC mode (the Board''s B2b-v-i): the call log for a customer, append only, after gc_company_contacts. One line per call, text, email or note, with the job it was about when it was about one (GcCustomer.contacts). The office team''s; by_user_id is the signed-in user.';

CREATE INDEX IF NOT EXISTS gc_customer_contacts_customer_idx ON public.gc_customer_contacts (customer_id, contacted_on DESC);

ALTER TABLE public.gc_customer_contacts ENABLE ROW LEVEL SECURITY;

-- The office team reads and logs, as door 2's one policy a table.
DROP POLICY IF EXISTS gc_customer_contacts_team ON public.gc_customer_contacts;
CREATE POLICY gc_customer_contacts_team ON public.gc_customer_contacts FOR ALL TO authenticated
  USING ((SELECT public.gc_office_team())) WITH CHECK ((SELECT public.gc_office_team()));

-- Nobody signed out reaches it. Signed in: read, and insert the line's own columns; who logged it and when are the
-- table's to set. Never changed once written.
REVOKE ALL ON TABLE public.gc_customer_contacts FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.gc_customer_contacts FROM authenticated;
GRANT SELECT ON TABLE public.gc_customer_contacts TO authenticated;
GRANT INSERT (customer_id, project_id, contacted_on, by_name, how, note) ON TABLE public.gc_customer_contacts TO authenticated;

-- House rules: read-only training mode and the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
