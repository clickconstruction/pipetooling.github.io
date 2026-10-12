SET lock_timeout = '3s';

-- Messages, cut 8 (the portals): the papers each customer was sent, for the office's read-back (the thread header's
-- portal pill, Follow up's portal rows, the step card's So far, By company's Portal column). Read as each paper's
-- non-money half, for the office team, the way gc_change_orders_office gives a change order's and
-- gc_company_paper_states gives a company's papers: our contract (its newest send on each job), each change order sent,
-- each pay application sent, with whether it was answered and the customer's first outside open of it on their page
-- (public_page_views' portal_paper rows, 20261012130000).
--
-- Assistants drive Messages, and the three tables read only for the money team (gc_owner_contract_sends from award's
-- door), so under their own policies the read-back would show an assistant no paper at all. The lead's call (a), to be
-- reported to the owner as taken: the office reads a paper's number, job, description, day and answer, never a dollar.
-- A change order's number, words and status already read for the office through gc_change_orders_office; a pay
-- application's number and day without a dollar follow the rule cut 9 set for the superintendent. Never cost, price,
-- worth, total, an amount or a link token.

CREATE OR REPLACE FUNCTION public.customer_portal_papers(p_customer_ids uuid[])
RETURNS TABLE (
  customer_id uuid,
  project_id uuid,
  job text,
  paper_kind text,
  paper_id uuid,
  number integer,
  description text,
  sent_on date,
  answered boolean,
  first_opened_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH jobs AS (
    SELECT p.id AS project_id, p.customer_id, p.name, g.owner_contract_signed_on
    FROM public.projects p
    JOIN public.gc_projects g ON g.project_id = p.id
    WHERE p.customer_id = ANY (coalesce(p_customer_ids, '{}'::uuid[]))
  ),
  -- Our contract on each job: its newest send. Answered once signed on their page or marked signed at the office.
  contracts AS (
    SELECT DISTINCT ON (s.project_id)
      j.customer_id, j.project_id, j.name AS job, s.id AS paper_id, s.sent_on,
      (s.signed_on IS NOT NULL OR j.owner_contract_signed_on IS NOT NULL) AS answered
    FROM public.gc_owner_contract_sends s
    JOIN jobs j ON j.project_id = s.project_id
    ORDER BY s.project_id, s.sent_on DESC, s.created_at DESC
  ),
  papers AS (
    SELECT c.customer_id, c.project_id, c.job, 'contract'::text AS paper_kind, c.paper_id, NULL::integer AS number,
           NULL::text AS description, c.sent_on, c.answered
    FROM contracts c
    UNION ALL
    -- A change order once it went: answered when signed or declined.
    SELECT j.customer_id, j.project_id, j.name, 'change_order', o.id, o.number, o.description, o.sent_on,
           o.status IN ('signed', 'declined')
    FROM public.gc_change_orders o
    JOIN jobs j ON j.project_id = o.project_id
    WHERE o.status <> 'draft' AND o.sent_on IS NOT NULL
    UNION ALL
    -- A pay application once it went: paid, never answered here.
    SELECT j.customer_id, j.project_id, j.name, 'pay_app', a.id, a.number, NULL, a.sent_on, false
    FROM public.gc_owner_pay_apps a
    JOIN jobs j ON j.project_id = a.project_id
  )
  SELECT p.customer_id, p.project_id, p.job, p.paper_kind, p.paper_id, p.number, p.description, p.sent_on, p.answered,
         (SELECT min(v.occurred_at)
          FROM public.public_page_views v
          WHERE v.surface = 'portal_paper'
            AND v.entity_id = p.customer_id
            AND v.paper_kind = p.paper_kind
            AND v.paper_id = p.paper_id
            AND coalesce(v.viewer, 'outside') = 'outside') AS first_opened_at
  FROM papers p
  WHERE (SELECT public.gc_office_team())
  ORDER BY p.customer_id, p.project_id, p.paper_kind, p.number NULLS FIRST, p.sent_on;
$$;

COMMENT ON FUNCTION public.customer_portal_papers(uuid[]) IS
  'Messages cut 8: each paper sent to the customers named, as its non-money half, for the office team (gc_office_team()): our contract''s newest send per job, each change order sent, each pay application sent, with the job, number, description, day, whether answered and the customer''s first outside open on their page. Never cost, price, worth, total, an amount or a token. Read beside customer_portal_views (the page''s own opens).';
REVOKE ALL ON FUNCTION public.customer_portal_papers(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_papers(uuid[]) TO authenticated, service_role;
