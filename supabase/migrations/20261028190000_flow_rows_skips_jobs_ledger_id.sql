-- The step card's Put it back on a residential customer's step (v2.6016 filed their skip on jobs_ledger_id, the Pipeline job's
-- column) could not find the skip: flow_rows_for built each skip with project_id alone, so the client's lookup by job never
-- matched and flow_unskip_step was never called. The skip object gains jobs_ledger_id; nothing else in the function changes.
-- No table is created, so no fence calls.
SET lock_timeout = '3s';

-- These contacts' rows as src/lib/flows/load.ts's FlowRows, keyed by contact id, read set-wise so a board of everyone
-- is one read. Each also carries 'card', the names a board prints. Days and marks only, never an amount or a price; a
-- trade partner's page as the office's preview link ('/t/<token>?preview=1', so an office open never counts as theirs),
-- the one place a token appears. Internal: flow_rows and flow_rows_kind, which gate it, read it as its owner.
CREATE OR REPLACE FUNCTION public.flow_rows_for(p_ids uuid[])
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH k AS (
    SELECT c.id, c.kind, c.name, c.goes_by, c.off_since, c.off_why, c.off_by,
      coalesce(c.gc_company_id, gp.company_id) AS company,
      coalesce(c.customer_id, cp.customer_id) AS customer,
      coalesce(c.name, gp.name, cp.name, pe.name) AS person_name
    FROM public.contacts c
    LEFT JOIN public.gc_company_people gp ON gp.id = c.gc_company_person_id
    LEFT JOIN public.customer_contact_persons cp ON cp.id = c.customer_contact_person_id
    LEFT JOIN public.people pe ON pe.id = c.person_id
    WHERE c.id = ANY (p_ids)
  ),
  pj AS (SELECT j.contact_id AS cid, j.project_id AS pid FROM public.flow_jobs_of(p_ids) j),
  kp AS (SELECT pj.cid, pj.pid, k.kind FROM pj JOIN k ON k.id = pj.cid),
  inv AS (SELECT k.id AS cid, i.id, i.company_id, i.package_id, i.invited_on, i.status, i.declined_on, i.lost_on
    FROM k JOIN public.gc_invites i ON i.company_id = k.company WHERE k.kind = 'trade'),
  sw AS (SELECT k.id AS cid, s.id, s.invite_id, s.package_id, s.sent_on, s.signed_on
    FROM k JOIN public.gc_sows s ON s.company_id = k.company WHERE k.kind = 'trade'),
  names AS (SELECT coalesce(jsonb_object_agg(u.id, split_part(btrim(u.name), ' ', 1)), '{}'::jsonb) AS v FROM public.users u
    WHERE u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'estimator') AND coalesce(btrim(u.name), '') <> ''),
  a_jobs AS (SELECT j.contact_id AS cid, jsonb_agg(jsonb_build_object('project_id', j.project_id, 'is_default', j.is_default)) AS v
    FROM public.contact_jobs j WHERE j.contact_id = ANY (p_ids) AND j.project_id IS NOT NULL GROUP BY j.contact_id),
  a_company AS (SELECT k.id AS cid, jsonb_build_object('id', g.id, 'portal_opened_on', g.portal_opened_on) AS v, g.name AS company_name, g.trades
    FROM k JOIN public.gc_companies g ON g.id = k.company WHERE k.kind = 'trade'),
  a_customer AS (SELECT k.id AS cid, cu.name AS customer_name FROM k JOIN public.customers cu ON cu.id = k.customer WHERE k.kind IN ('customer', 'arch')),
  a_links AS (SELECT k.id AS cid, jsonb_agg(jsonb_build_object('company_id', l.company_id, 'revoked_at', l.revoked_at, 'first_opened_at', l.first_opened_at)) AS v
    FROM k JOIN public.gc_trade_portal_links l ON l.company_id = k.company WHERE k.kind = 'trade' GROUP BY k.id),
  a_preview AS (SELECT DISTINCT ON (k.id) k.id AS cid, '/t/' || l.token || '?preview=1' AS v
    FROM k JOIN public.gc_trade_portal_links l ON l.company_id = k.company
    WHERE k.kind = 'trade' AND l.revoked_at IS NULL AND l.token IS NOT NULL ORDER BY k.id, l.created_at DESC),
  a_msgs AS (SELECT k.id AS cid, jsonb_agg(jsonb_build_object('company_id', m.company_id, 'kind', m.kind, 'sent_on', m.sent_on, 'sent_by', m.sent_by)) AS v
    FROM k JOIN public.gc_trade_messages m ON m.company_id = k.company WHERE k.kind = 'trade' AND m.kind = 'invite' GROUP BY k.id),
  a_papers AS (SELECT k.id AS cid, jsonb_agg(jsonb_build_object('id', d.id, 'company_id', d.company_id, 'doc_type', d.doc_type, 'status', d.status,
      'sent_at', d.sent_at, 'signed_at', d.signed_at, 'expires_at', d.expires_at, 'created_at', d.created_at,
      'library_id', d.applied_contract_template_document_id)) AS v
    FROM k JOIN public.person_contract_documents d ON d.company_id = k.company WHERE k.kind = 'trade' GROUP BY k.id),
  a_psends AS (SELECT k.id AS cid, jsonb_agg(jsonb_build_object('paper', s.paper, 'project_id', s.project_id, 'sent_on', s.sent_on, 'created_at', s.created_at)) AS v
    FROM k JOIN public.gc_paper_sends s ON s.company_id = k.company WHERE k.kind = 'trade' GROUP BY k.id),
  a_invites AS (SELECT inv.cid, jsonb_agg(jsonb_build_object('id', inv.id, 'company_id', inv.company_id, 'package_id', inv.package_id,
      'invited_on', inv.invited_on, 'status', inv.status, 'declined_on', inv.declined_on, 'lost_on', inv.lost_on)) AS v
    FROM inv GROUP BY inv.cid),
  a_packages AS (SELECT x.cid, jsonb_agg(jsonb_build_object('id', x.id, 'project_id', x.project_id, 'trade', x.trade, 'carried_invite_id', x.carried_invite_id,
      'awarded_invite_id', x.awarded_invite_id, 'awarded_on', x.awarded_on, 'awarded_by', x.awarded_by)) AS v
    FROM (SELECT DISTINCT inv.cid, p.id, p.project_id, p.trade, p.carried_invite_id, p.awarded_invite_id, p.awarded_on, p.awarded_by
      FROM inv JOIN public.gc_trade_packages p ON p.id = inv.package_id) x
    GROUP BY x.cid),
  a_quotes AS (SELECT inv.cid, jsonb_agg(jsonb_build_object('invite_id', q.invite_id, 'submitted_on', q.submitted_on, 'created_at', q.created_at)) AS v
    FROM inv JOIN public.gc_quotes q ON q.invite_id = inv.id GROUP BY inv.cid),
  a_asks AS (SELECT inv.cid, jsonb_agg(jsonb_build_object('invite_id', l.invite_id, 'promised_by', l.promised_by, 'contacted_on', l.contacted_on, 'created_at', l.created_at)) AS v
    FROM inv JOIN public.gc_company_contacts l ON l.invite_id = inv.id AND l.promised_by IS NOT NULL GROUP BY inv.cid),
  a_sows AS (SELECT sw.cid, jsonb_agg(jsonb_build_object('id', sw.id, 'invite_id', sw.invite_id, 'package_id', sw.package_id, 'sent_on', sw.sent_on, 'signed_on', sw.signed_on)) AS v
    FROM sw GROUP BY sw.cid),
  a_draws AS (SELECT sw.cid, jsonb_agg(jsonb_build_object('id', d.id, 'sow_id', d.sow_id, 'number', d.number, 'requested_on', d.requested_on,
      'approved_on', d.approved_on, 'paid_on', d.paid_on, 'final', d.final, 'waiver', d.waiver, 'waiver_on', d.waiver_on)) AS v
    FROM sw JOIN public.gc_draws d ON d.sow_id = sw.id GROUP BY sw.cid),
  a_files AS (SELECT k.id AS cid, jsonb_agg(jsonb_build_object('company_id', f.company_id, 'project_id', f.project_id, 'paper', f.paper, 'uploaded_at', f.uploaded_at)) AS v
    FROM k JOIN public.gc_trade_files f ON f.company_id = k.company WHERE k.kind = 'trade' AND f.paper IS NOT NULL GROUP BY k.id),
  a_projects AS (SELECT pj.cid, jsonb_agg(jsonb_build_object('project_id', g.project_id, 'name', pr.name, 'stage', g.stage, 'created_at', g.created_at,
      'bid_due', g.bid_due, 'our_bid_sent_on', g.our_bid_sent_on, 'won_on', g.won_on, 'lost_on', g.lost_on,
      'owner_contract_sent_on', g.owner_contract_sent_on, 'owner_contract_signed_on', g.owner_contract_signed_on,
      'started_on', g.started_on, 'closed_on', g.closed_on, 'owner_pay_days', g.owner_pay_days)) AS v
    FROM pj JOIN public.gc_projects g ON g.project_id = pj.pid JOIN public.projects pr ON pr.id = g.project_id GROUP BY pj.cid),
  a_sched AS (SELECT kp.cid, jsonb_agg(jsonb_build_object('project_id', s.project_id, 'sent_on', s.sent_on, 'sent_by', s.sent_by)) AS v
    FROM kp JOIN public.gc_schedule_sends s ON s.project_id = kp.pid WHERE kp.kind = 'customer' GROUP BY kp.cid),
  a_payapps AS (SELECT kp.cid, jsonb_agg(jsonb_build_object('id', a.id, 'project_id', a.project_id, 'number', a.number, 'sent_on', a.sent_on,
      'certified_on', a.certified_on, 'paid_on', a.paid_on,
      'invoice_paid', coalesce(inv2.status = 'paid' OR inv2.stripe_invoice_status = 'paid', false))) AS v
    FROM kp JOIN public.gc_owner_pay_apps a ON a.project_id = kp.pid
    LEFT JOIN public.jobs_ledger_invoices inv2 ON inv2.id = a.invoice_id
    WHERE kp.kind IN ('customer', 'arch') GROUP BY kp.cid),
  a_accepts AS (SELECT kp.cid, jsonb_agg(jsonb_build_object('project_id', a.project_id, 'accepted_on', a.accepted_on)) AS v
    FROM kp JOIN public.gc_owner_acceptances a ON a.project_id = kp.pid WHERE kp.kind = 'customer' GROUP BY kp.cid),
  a_cos AS (SELECT kp.cid, jsonb_agg(jsonb_build_object('id', o.id, 'project_id', o.project_id, 'number', o.number, 'description', o.description,
      'status', o.status, 'sent_on', o.sent_on, 'answered_on', o.answered_on)) AS v
    FROM kp JOIN public.gc_change_orders o ON o.project_id = kp.pid WHERE kp.kind = 'customer' GROUP BY kp.cid),
  a_sets AS (SELECT kp.cid, jsonb_agg(jsonb_build_object('id', s.id, 'project_id', s.project_id, 'kind', s.kind, 'label', s.label, 'issued_on', s.issued_on)) AS v
    FROM kp JOIN public.gc_plan_sets s ON s.project_id = kp.pid WHERE kp.kind IN ('customer', 'arch') GROUP BY kp.cid),
  a_setsends AS (SELECT kp.cid, jsonb_agg(jsonb_build_object('set_id', x.set_id, 'sent_at', x.sent_at)) AS v
    FROM kp JOIN public.gc_plan_sets s ON s.project_id = kp.pid AND s.kind = 'addendum'
    JOIN public.gc_plan_set_sends x ON x.set_id = s.id WHERE kp.kind = 'arch' GROUP BY kp.cid),
  a_questions AS (SELECT kp.cid, jsonb_agg(jsonb_build_object('id', q.id, 'project_id', q.project_id, 'text', q.text,
      'sent_to_architect_on', q.sent_to_architect_on, 'answered_on', q.answered_on)) AS v
    FROM kp JOIN public.gc_plan_questions q ON q.project_id = kp.pid WHERE kp.kind = 'arch' GROUP BY kp.cid),
  a_rfis AS (SELECT kp.cid, jsonb_agg(jsonb_build_object('id', r.id, 'project_id', r.project_id, 'number', r.number, 'question', r.question,
      'sent_to_architect_on', r.sent_to_architect_on, 'answered_on', r.answered_on, 'needed_days', r.needed_days)) AS v
    FROM kp JOIN public.gc_rfis r ON r.project_id = kp.pid WHERE kp.kind = 'arch' GROUP BY kp.cid),
  a_subs AS (SELECT kp.cid, jsonb_agg(jsonb_build_object('id', r.id, 'project_id', s.project_id, 'name', s.title, 'round', r.round,
      'to_architect_on', r.to_architect_on, 'sent_on', r.sent_on, 'answered_on', r.answered_on)) AS v
    FROM kp JOIN public.gc_submittals s ON s.project_id = kp.pid JOIN public.gc_submittal_rounds r ON r.submittal_id = s.id
    WHERE kp.kind = 'arch' GROUP BY kp.cid),
  a_skips AS (SELECT s.contact_id AS cid, jsonb_agg(jsonb_build_object('id', s.id, 'step_key', s.step_key, 'project_id', s.project_id, 'jobs_ledger_id', s.jobs_ledger_id, 'why', s.why,
      'by_name', s.by_name, 'created_at', s.created_at, 'undone_at', s.undone_at)) AS v
    FROM public.contact_step_skips s WHERE s.contact_id = ANY (p_ids) AND s.undone_at IS NULL GROUP BY s.contact_id),
  a_arch AS (SELECT kp.cid, jsonb_object_agg(g.project_id, ac.id) AS v
    FROM kp JOIN public.gc_projects g ON g.project_id = kp.pid AND g.architect_customer_id IS NOT NULL
    JOIN LATERAL (
      SELECT ct.id FROM public.contacts ct
      LEFT JOIN public.customer_contact_persons cp2 ON cp2.id = ct.customer_contact_person_id
      WHERE ct.kind = 'arch' AND (ct.customer_id = g.architect_customer_id OR cp2.customer_id = g.architect_customer_id)
      ORDER BY ct.customer_id IS NULL, ct.created_at
      LIMIT 1
    ) ac ON true
    WHERE kp.kind = 'customer' GROUP BY kp.cid)
  SELECT coalesce(jsonb_object_agg(k.id, jsonb_build_object(
    'contact', jsonb_build_object('id', k.id, 'kind', k.kind, 'off_since', k.off_since, 'off_why', k.off_why, 'off_by', k.off_by),
    'card', jsonb_build_object(
      'name', coalesce(k.person_name, co.company_name, cu.customer_name, ''),
      'goes_by', k.goes_by,
      'company', coalesce(co.company_name, cu.customer_name),
      'trades', coalesce(to_jsonb(co.trades), '[]'::jsonb),
      'gc_company_id', CASE WHEN k.kind = 'trade' THEN k.company END,
      'customer_id', CASE WHEN k.kind IN ('customer', 'arch') THEN k.customer END),
    'contactJobs', coalesce(a_jobs.v, '[]'::jsonb),
    'userNames', (SELECT v FROM names),
    'company', co.v,
    'portalLinks', coalesce(a_links.v, '[]'::jsonb),
    'previewPath', a_preview.v,
    'tradeMessages', coalesce(a_msgs.v, '[]'::jsonb),
    'papers', coalesce(a_papers.v, '[]'::jsonb),
    'paperSends', coalesce(a_psends.v, '[]'::jsonb),
    'invites', coalesce(a_invites.v, '[]'::jsonb),
    'packages', coalesce(a_packages.v, '[]'::jsonb),
    'quotes', coalesce(a_quotes.v, '[]'::jsonb),
    'askLines', coalesce(a_asks.v, '[]'::jsonb),
    'sows', coalesce(a_sows.v, '[]'::jsonb),
    'draws', coalesce(a_draws.v, '[]'::jsonb),
    'tradeFiles', coalesce(a_files.v, '[]'::jsonb),
    'projects', coalesce(a_projects.v, '[]'::jsonb),
    'scheduleSends', coalesce(a_sched.v, '[]'::jsonb),
    'payApps', coalesce(a_payapps.v, '[]'::jsonb),
    'acceptances', coalesce(a_accepts.v, '[]'::jsonb),
    'changeOrders', coalesce(a_cos.v, '[]'::jsonb),
    'planSets', coalesce(a_sets.v, '[]'::jsonb),
    'planSetSends', coalesce(a_setsends.v, '[]'::jsonb),
    'planQuestions', coalesce(a_questions.v, '[]'::jsonb),
    'rfis', coalesce(a_rfis.v, '[]'::jsonb),
    'submittalRounds', coalesce(a_subs.v, '[]'::jsonb),
    'skips', coalesce(a_skips.v, '[]'::jsonb),
    'architectByProject', coalesce(a_arch.v, '{}'::jsonb))), '{}'::jsonb)
  FROM k
  LEFT JOIN a_jobs ON a_jobs.cid = k.id
  LEFT JOIN a_company co ON co.cid = k.id
  LEFT JOIN a_customer cu ON cu.cid = k.id
  LEFT JOIN a_links ON a_links.cid = k.id
  LEFT JOIN a_preview ON a_preview.cid = k.id
  LEFT JOIN a_msgs ON a_msgs.cid = k.id
  LEFT JOIN a_papers ON a_papers.cid = k.id
  LEFT JOIN a_psends ON a_psends.cid = k.id
  LEFT JOIN a_invites ON a_invites.cid = k.id
  LEFT JOIN a_packages ON a_packages.cid = k.id
  LEFT JOIN a_quotes ON a_quotes.cid = k.id
  LEFT JOIN a_asks ON a_asks.cid = k.id
  LEFT JOIN a_sows ON a_sows.cid = k.id
  LEFT JOIN a_draws ON a_draws.cid = k.id
  LEFT JOIN a_files ON a_files.cid = k.id
  LEFT JOIN a_projects ON a_projects.cid = k.id
  LEFT JOIN a_sched ON a_sched.cid = k.id
  LEFT JOIN a_payapps ON a_payapps.cid = k.id
  LEFT JOIN a_accepts ON a_accepts.cid = k.id
  LEFT JOIN a_cos ON a_cos.cid = k.id
  LEFT JOIN a_sets ON a_sets.cid = k.id
  LEFT JOIN a_setsends ON a_setsends.cid = k.id
  LEFT JOIN a_questions ON a_questions.cid = k.id
  LEFT JOIN a_rfis ON a_rfis.cid = k.id
  LEFT JOIN a_subs ON a_subs.cid = k.id
  LEFT JOIN a_skips ON a_skips.cid = k.id
  LEFT JOIN a_arch ON a_arch.cid = k.id
$$;
