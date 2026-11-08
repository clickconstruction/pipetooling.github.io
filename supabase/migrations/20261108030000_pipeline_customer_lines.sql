SET lock_timeout = '3s';

-- v2.6683 (punch list #125, PR 1): the Pipeline board's read of the customer's conversation, one call per slice of
-- jobs beside jobs_ledger_thread_note_stats. For each job it returns the newest p_per_job calls, texts, emails and
-- portal lines between us and the people on the job, under Job activity's rule and the customer sheet's, so the row's
-- box, the bubble's sheet and Job activity show the same lines:
--   * every line tied to the job (messages.jobs_ledger_id), whoever it is with;
--   * while the job is not paid, the lines tied to no job yet of the customers put on it (contact_jobs), since the
--     job began — the same rows loadJobMessages reads (src/lib/messages/messagesIo.ts, jobActivityMessagesFromRows);
--   * a note, an event and a team line are ours alone and never among them (lastLinesOnJob's WORD_CHANNELS).
-- SECURITY INVOKER: the rows' own policies decide who reads (messages_team, gc_office_team()), as in Job activity;
-- anyone else gets no rows and the board draws nothing new. Read-only, no table, so no fence is owed.

-- The tied lines by job: the thread index is by contact; the board asks by job.
CREATE INDEX IF NOT EXISTS messages_job_lines ON public.messages (jobs_ledger_id, at DESC) WHERE jobs_ledger_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.pipeline_customer_lines(p_job_ids uuid[], p_per_job integer DEFAULT 3)
RETURNS TABLE (
  job_id uuid,
  id uuid,
  contact_id uuid,
  contact_kind text,
  contact_name text,
  contact_goes_by text,
  channel text,
  direction text,
  at timestamptz,
  who_user_id uuid,
  who_text text,
  who_name text,
  subject text,
  body text,
  duration_seconds integer,
  summary text,
  transcript text,
  delivery text,
  auto boolean,
  tied boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH jobs AS (
    SELECT j.id, j.status, j.created_at
    FROM public.jobs_ledger j
    WHERE p_job_ids IS NOT NULL AND j.id = ANY (p_job_ids)
  ),
  tied AS (
    SELECT j.id AS job_id, m.id, m.contact_id, m.channel, m.direction, m.at, m.who_user_id, m.who_text, m.subject, m.body,
           m.duration_seconds, m.summary, m.transcript, m.delivery, m.auto, true AS tied
    FROM jobs j
    JOIN public.messages m ON m.jobs_ledger_id = j.id
    WHERE m.channel IN ('call', 'voicemail', 'missed', 'text', 'email', 'portal')
      AND m.direction IN ('in', 'out')
  ),
  customers_on AS (
    SELECT DISTINCT cj.jobs_ledger_id AS job_id, cj.contact_id
    FROM public.contact_jobs cj
    JOIN public.contacts c ON c.id = cj.contact_id AND c.kind = 'customer'
    WHERE p_job_ids IS NOT NULL AND cj.jobs_ledger_id = ANY (p_job_ids)
  ),
  untied AS (
    SELECT j.id AS job_id, m.id, m.contact_id, m.channel, m.direction, m.at, m.who_user_id, m.who_text, m.subject, m.body,
           m.duration_seconds, m.summary, m.transcript, m.delivery, m.auto, false AS tied
    FROM jobs j
    JOIN customers_on co ON co.job_id = j.id
    JOIN public.messages m ON m.contact_id = co.contact_id
    WHERE j.status IS DISTINCT FROM 'paid'
      AND m.bid_id IS NULL AND m.project_id IS NULL AND m.jobs_ledger_id IS NULL
      AND m.channel IN ('call', 'voicemail', 'missed', 'text', 'email', 'portal')
      AND m.direction IN ('in', 'out')
      AND (j.created_at IS NULL OR m.at >= j.created_at)
  ),
  ranked AS (
    SELECT l.*, row_number() OVER (PARTITION BY l.job_id ORDER BY l.at DESC, l.id DESC) AS rn
    FROM (SELECT * FROM tied UNION ALL SELECT * FROM untied) l
  )
  SELECT
    r.job_id,
    r.id,
    r.contact_id,
    c.kind AS contact_kind,
    coalesce(nullif(btrim(c.name), ''), cu.name, ccp.name, '') AS contact_name,
    c.goes_by AS contact_goes_by,
    r.channel,
    r.direction,
    r.at,
    r.who_user_id,
    r.who_text,
    u.name AS who_name,
    r.subject,
    left(r.body, 400) AS body,
    r.duration_seconds,
    left(r.summary, 400) AS summary,
    left(r.transcript, 400) AS transcript,
    r.delivery,
    r.auto,
    r.tied
  FROM ranked r
  JOIN public.contacts c ON c.id = r.contact_id
  LEFT JOIN public.customers cu ON cu.id = c.customer_id
  LEFT JOIN public.customer_contact_persons ccp ON ccp.id = c.customer_contact_person_id
  LEFT JOIN public.users u ON u.id = r.who_user_id
  WHERE r.rn <= greatest(1, least(coalesce(p_per_job, 3), 10))
  ORDER BY r.job_id, r.at DESC, r.id DESC
$$;

COMMENT ON FUNCTION public.pipeline_customer_lines(uuid[], integer) IS
  'Punch list #125 (v2.6683): the newest p_per_job (1 to 10, default 3) calls, texts, emails and portal lines per Pipeline job for the board''s activity box and phone card — the lines tied to the job and, while it is unpaid, the untied lines of the customers on it since it began; the same rows Job activity and the customer sheet read. SECURITY INVOKER: the messages policies decide who reads.';

REVOKE EXECUTE ON FUNCTION public.pipeline_customer_lines(uuid[], integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pipeline_customer_lines(uuid[], integer) TO authenticated, service_role;
