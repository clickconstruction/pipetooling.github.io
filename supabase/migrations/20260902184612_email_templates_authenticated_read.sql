SET lock_timeout = '3s';

-- Email wording, PR 2 (v2.2658): client-built senders (lien release, hazmat
-- notice, supply-house share — used by assistants, not just devs) now read
-- wording overrides from email_templates before composing. The table was
-- dev-only SELECT (baseline); templates hold no secrets — wording only —
-- so authenticated read is safe. Writes stay dev-only. Idempotent.

DROP POLICY IF EXISTS email_templates_authenticated_read ON public.email_templates;
CREATE POLICY email_templates_authenticated_read
  ON public.email_templates FOR SELECT TO authenticated
  USING (true);

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
