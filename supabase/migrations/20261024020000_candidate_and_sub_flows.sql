SET lock_timeout = '3s';

-- Messages, the candidate flow and the sub flow's Once lane (spike of 2026-10-23 on the Who is this? card; the kernels
-- are src/lib/flows/facts.ts, seed.ts, candidateLoad.ts and subOnboardingLoad.ts). A person we may hire gets a flow
-- of their own, one Once lane read from their row on the Team hiring board (team_prospects): rated, screened by
-- phone, on a try-out, hired or passed. A sub coming on gets a Once lane before their jobs on the sub flow: reached
-- out, W-9 in, insurance in, agreement signed, first job done, kept or let go, read from the thread, their papers on
-- People and their sheets. No column is added and no table made; the client reads those rows itself until flow_rows
-- carries them.
--   * flows.kind may also be candidate.
--   * flow_fact_ids() gains the five hiring facts after sub_paid, in facts.ts's order: cand_rated, cand_called,
--     cand_trial, cand_hired, cand_passed, then the sub lane's five: sub_reached, sub_agreement, sub_first_done,
--     sub_kept, sub_let_go. flow_paper_ids() stays as *_residential_flow left it.
--   * flows_seed() seeds the candidate flow as well: one Once lane of four steps, Rated to Hired or passed, the last a
--     fork whose either way ends the lane, no reminders. On a database seeded before (prod) the run below adds the
--     candidate flow alone, since every other kind already has its flow; the sub flow's Once lane is added below.
-- src/lib/flows/flowsSql.test.ts holds the kinds, the facts and the seed to the code, as it reads the newest migration
-- that defines each.

-- ---------- the kinds a flow is for ----------

ALTER TABLE public.flows
  DROP CONSTRAINT IF EXISTS flows_kind_known,
  ADD CONSTRAINT flows_kind_known CHECK (kind IN ('customer', 'trade', 'arch', 'unknown', 'residential', 'sub', 'candidate'));

-- ---------- the facts a step picks from ----------

CREATE OR REPLACE FUNCTION public.flow_fact_ids()
RETURNS text[]
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
AS $$
  SELECT ARRAY['invite_sent', 'portal_opened', 'w9_signed', 'coi_current', 'msa_signed', 'quote_in', 'quote_declined', 'tab_seen', 'carried', 'not_carried', 'sow_signed', 'draw_requested', 'draw_approved', 'draw_paid', 'final_waiver', 'asked_us', 'bid_sent', 'said_yes', 'declined', 'contract_signed', 'start_sent', 'started', 'payapp_paid', 'closed', 'warranty_over', 'co_answered', 'plans_in', 'question_answered', 'addendum_filed', 'addendum_sent', 'submittal_reviewed', 'certified', 'named', 'booked', 'on_way', 'arrived', 'found', 'estimate_sent', 'estimate_approved', 'working', 'done', 'billed', 'paid', 'review_asked', 'sub_asked', 'sub_said_yes', 'sub_declined', 'sub_on_site', 'sub_done', 'sub_paid', 'qualifications_noted', 'cand_called', 'cand_trial', 'cand_hired', 'cand_passed', 'sub_reached', 'sub_agreement', 'sub_first_done', 'sub_kept', 'sub_let_go']::text[]
$$;

-- ---------- the seed, for a kind with no flow yet ----------

CREATE OR REPLACE FUNCTION public.flows_seed()
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  added integer;
BEGIN
  WITH new_flows AS (
    INSERT INTO public.flows (kind, name)
    VALUES ('customer', 'Customer flow'), ('trade', 'Trade partner flow'), ('arch', 'Architect flow'), ('unknown', 'The flow'), ('residential', 'Residential customer flow'), ('sub', 'Sub flow'), ('candidate', 'Candidate flow')
    ON CONFLICT (kind) DO NOTHING
    RETURNING id, kind
  ), seeded AS (
    INSERT INTO public.flow_steps (flow_id, step_key, lane, position, name, name_es, phase, who, facts, join_word, papers,
      loop_words, loop_ends, fork, aside, skip_one_job, later_en, later_es, nudge_days, nudge_how, nudge_send,
      nudge_day_fact, usual, owed_words)
    SELECT f.id, s.step_key, s.lane, s.position, s.name, s.name_es, s.phase, s.who, s.facts, s.join_word, s.papers,
      s.loop_words, s.loop_ends, s.fork, s.aside, s.skip_one_job, s.later_en, s.later_es, s.nudge_days, s.nudge_how,
      s.nudge_send, s.nudge_day_fact, s.usual, s.owed_words
    FROM new_flows f
    JOIN (VALUES
      ('trade', 'invited', 'once', 0, 'Invited', 'Invitado', 'setup', 'us', ARRAY['invite_sent'], 'and', ARRAY['invitation'], NULL, NULL, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 2, 'the invitation'),
      ('trade', 'portal', 'once', 1, 'Portal opened', 'Portal abierto', 'setup', 'them', ARRAY['portal_opened'], 'and', '{}'::text[], NULL, NULL, false, false, false, NULL, NULL, 3, 'text', 'app', NULL, 1, NULL),
      ('trade', 'papers', 'once', 2, 'Papers in', 'Documentos recibidos', 'setup', 'them', ARRAY['w9_signed', 'coi_current'], 'and', ARRAY['w9', 'coi'], NULL, NULL, false, false, false, NULL, NULL, 5, 'call', 'ask', NULL, 3, NULL),
      ('trade', 'msa', 'once', 3, 'MSA signed', 'Acuerdo firmado', 'setup', 'them', ARRAY['msa_signed'], 'and', ARRAY['msa'], NULL, NULL, false, false, false, NULL, NULL, 3, 'text', 'ask', NULL, 4, NULL),
      ('trade', 'ask', 'per_job', 0, 'Asked to quote', 'Cotización pedida', 'pricing', 'them', ARRAY['quote_in', 'quote_declined'], 'or', ARRAY['quote'], 'each ask', 'rounds', false, false, false, 'When a job of yours comes up.', 'Cuando surja un trabajo para usted.', 7, 'text', 'ask', 'promised', 6, NULL),
      ('trade', 'compare', 'per_job', 1, 'Compared', 'Comparado', 'pricing', 'us', ARRAY['carried', 'not_carried'], 'or', '{}'::text[], NULL, NULL, true, false, false, 'After your quote is in.', 'Después de recibir su cotización.', NULL, NULL, NULL, NULL, 2, 'our decision on their quote'),
      ('trade', 'sow', 'per_job', 2, 'Statement of work', 'Alcance de trabajo', 'building', 'them', ARRAY['sow_signed'], 'and', ARRAY['sow'], NULL, NULL, false, false, false, 'If we carry your quote.', 'Si llevamos su cotización.', 3, 'text', 'ask', NULL, 5, NULL),
      ('trade', 'draws', 'per_job', 3, 'Draws', 'Pagos parciales', 'building', 'both', ARRAY['draw_requested', 'draw_paid'], 'and', ARRAY['waiver'], 'each draw', 'next', false, false, false, 'Monthly, once you are on site.', 'Cada mes, una vez en obra.', NULL, NULL, NULL, NULL, 12, NULL),
      ('trade', 'closeout', 'per_job', 4, 'Closeout', 'Cierre', 'building', 'them', ARRAY['final_waiver'], 'and', ARRAY['final_waiver'], NULL, NULL, false, false, false, 'At the end of your work.', 'Al terminar su trabajo.', 7, 'email', 'ask', NULL, 9, NULL),
      ('customer', 'agreement', 'once', 0, 'Master agreement', 'Acuerdo marco', 'setup', 'them', ARRAY['msa_signed'], 'and', ARRAY['msa'], NULL, NULL, false, false, true, 'Repeat customers only.', 'Solo para clientes recurrentes.', 5, 'call', 'ask', NULL, 10, NULL),
      ('customer', 'asked', 'per_job', 0, 'Asked us', 'Nos consultó', 'pricing', 'them', ARRAY['asked_us'], 'and', '{}'::text[], NULL, NULL, false, false, false, 'When you ask, or your plans come in.', 'Cuando nos consulte, o lleguen sus planos.', NULL, NULL, NULL, NULL, 1, NULL),
      ('customer', 'bid', 'per_job', 1, 'Our bid', 'Nuestra oferta', 'pricing', 'us', ARRAY['bid_sent'], 'and', ARRAY['bid'], NULL, NULL, false, false, false, 'Within two weeks of your plans.', 'Dentro de dos semanas de recibir sus planos.', NULL, NULL, NULL, NULL, 9, 'our bid'),
      ('customer', 'yes', 'per_job', 2, 'Said yes', 'Aceptó', 'pricing', 'them', ARRAY['said_yes', 'declined'], 'or', '{}'::text[], NULL, NULL, true, false, false, NULL, NULL, 5, 'call', 'ask', NULL, 6, NULL),
      ('customer', 'contract', 'per_job', 3, 'Contract signed', 'Contrato firmado', 'pricing', 'them', ARRAY['contract_signed'], 'and', ARRAY['contract'], NULL, NULL, false, false, false, 'Once you say yes.', 'Cuando acepte.', 3, 'text', 'ask', NULL, 4, NULL),
      ('customer', 'start', 'per_job', 4, 'Start date', 'Fecha de inicio', 'building', 'us', ARRAY['start_sent'], 'and', ARRAY['schedule'], NULL, NULL, false, false, false, 'Once the contract is signed.', 'Cuando el contrato esté firmado.', NULL, NULL, NULL, NULL, 3, 'the start date'),
      ('customer', 'onsite', 'per_job', 5, 'On site', 'En obra', 'building', 'us', ARRAY['started'], 'and', '{}'::text[], NULL, NULL, false, false, false, 'After your start date.', 'Después de su fecha de inicio.', NULL, NULL, NULL, NULL, 10, 'the day we are on site'),
      ('customer', 'payapp', 'per_job', 6, 'Pay application', 'Solicitud de pago', 'building', 'both', ARRAY['payapp_paid'], 'and', ARRAY['payapp'], 'each month', 'next', false, false, false, 'Once a month, from the first month on site.', 'Una vez al mes, desde el primer mes en obra.', 5, 'text', 'ask', 'pay_by', 21, NULL),
      ('customer', 'close', 'per_job', 7, 'Closeout', 'Cierre', 'building', 'us', ARRAY['closed'], 'and', '{}'::text[], NULL, NULL, false, false, false, 'When the work is done and you accept it.', 'Cuando la obra termine y usted la acepte.', NULL, NULL, NULL, NULL, 14, 'the closeout papers'),
      ('customer', 'warranty', 'per_job', 8, 'Warranty', 'Garantía', 'building', 'us', ARRAY['warranty_over'], 'and', '{}'::text[], NULL, NULL, false, false, false, 'A year from closeout.', 'Un año desde el cierre.', NULL, NULL, NULL, NULL, 365, 'the warranty papers'),
      ('customer', 'co', 'per_job', 9, 'Change orders', 'Órdenes de cambio', 'building', 'them', ARRAY['co_answered'], 'and', ARRAY['co'], 'each change', 'rounds', false, true, false, 'Only when something changes.', 'Solo cuando algo cambie.', 3, 'text', 'ask', NULL, 4, NULL),
      ('arch', 'plans', 'per_job', 0, 'Plans in', 'Planos recibidos', 'building', 'them', ARRAY['plans_in'], 'and', ARRAY['plans'], NULL, NULL, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 2, NULL),
      ('arch', 'questions', 'per_job', 1, 'Questions', 'Preguntas', 'building', 'them', ARRAY['question_answered'], 'and', '{}'::text[], 'each question', 'rounds', false, false, false, NULL, NULL, 0, 'email', 'ask', 'questions_close', 3, NULL),
      ('arch', 'addenda', 'per_job', 2, 'Addenda', 'Adendas', 'building', 'them', ARRAY['addendum_filed', 'addendum_sent'], 'and', ARRAY['addendum'], 'each addendum', 'rounds', false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL),
      ('arch', 'submittals', 'per_job', 3, 'Submittals', 'Sometimientos', 'building', 'them', ARRAY['submittal_reviewed'], 'and', ARRAY['submittal'], 'each submittal', 'next', false, false, false, NULL, NULL, 10, 'email', 'ask', NULL, 8, NULL),
      ('arch', 'certify', 'per_job', 4, 'Certify pay apps', 'Certificar pagos', 'building', 'them', ARRAY['certified'], 'and', ARRAY['certificate'], 'each pay app', 'next', false, false, false, NULL, NULL, 3, 'email', 'ask', NULL, 4, NULL),
      ('residential', 'booked', 'per_job', 0, 'Booked', 'Agendado', 'setup', 'us', ARRAY['booked'], 'and', '{}'::text[], NULL, NULL, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 1, 'the day we come'),
      ('residential', 'onway', 'per_job', 1, 'On the way', 'En camino', 'setup', 'us', ARRAY['on_way'], 'and', '{}'::text[], NULL, NULL, false, false, false, 'On the day of your visit.', 'El día de su visita.', NULL, NULL, NULL, NULL, 3, 'a text when we leave'),
      ('residential', 'arrived', 'per_job', 2, 'Arrived', 'Llegamos', 'setup', 'us', ARRAY['arrived'], 'and', '{}'::text[], NULL, NULL, false, false, false, 'When our tech gets to you.', 'Cuando nuestro técnico llegue.', NULL, NULL, NULL, NULL, 0, 'the visit'),
      ('residential', 'found', 'per_job', 3, 'What we found', 'Lo que encontramos', 'setup', 'us', ARRAY['found'], 'and', '{}'::text[], NULL, NULL, false, false, false, 'After our tech looks.', 'Después de que nuestro técnico revise.', NULL, NULL, NULL, NULL, 0, 'what we found'),
      ('residential', 'estimate', 'per_job', 4, 'Estimate sent', 'Presupuesto enviado', 'pricing', 'us', ARRAY['estimate_sent'], 'and', ARRAY['estimate'], NULL, NULL, false, false, false, 'After we find the problem.', 'Después de encontrar el problema.', NULL, NULL, NULL, NULL, 1, 'the estimate'),
      ('residential', 'approved', 'per_job', 5, 'Approved', 'Aprobado', 'pricing', 'them', ARRAY['estimate_approved'], 'and', '{}'::text[], NULL, NULL, false, false, false, 'Once you have the estimate.', 'Cuando reciba el presupuesto.', 1, 'text', 'app', NULL, 3, NULL),
      ('residential', 'working', 'per_job', 6, 'Working', 'Trabajando', 'building', 'us', ARRAY['working'], 'and', '{}'::text[], NULL, NULL, false, false, false, 'Once you approve the estimate.', 'Cuando apruebe el presupuesto.', NULL, NULL, NULL, NULL, 2, 'the work'),
      ('residential', 'done', 'per_job', 7, 'Done', 'Terminado', 'building', 'us', ARRAY['done'], 'and', '{}'::text[], NULL, NULL, false, false, false, 'When the work is finished.', 'Cuando el trabajo esté terminado.', NULL, NULL, NULL, NULL, 3, 'word that the work is done'),
      ('residential', 'billed', 'per_job', 8, 'Billed', 'Facturado', 'building', 'us', ARRAY['billed'], 'and', ARRAY['bill'], 'each bill', 'rounds', false, false, false, 'After the work is done.', 'Después de terminar el trabajo.', NULL, NULL, NULL, NULL, 2, 'the bill'),
      ('residential', 'paid', 'per_job', 9, 'Paid', 'Pagado', 'building', 'them', ARRAY['paid'], 'and', '{}'::text[], 'each bill', 'rounds', false, false, false, 'When the bill comes.', 'Cuando llegue la factura.', 0, 'text', 'app', 'pay_by', 14, NULL),
      ('residential', 'review', 'per_job', 10, 'Review asked', 'Reseña pedida', 'building', 'us', ARRAY['review_asked'], 'and', '{}'::text[], NULL, NULL, false, false, false, 'After you pay.', 'Después de pagar.', NULL, NULL, NULL, NULL, 2, 'a review link'),
      ('sub', 'reached', 'once', 0, 'Reached out', 'Contactado', 'setup', 'us', ARRAY['sub_reached'], 'and', '{}'::text[], NULL, NULL, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 1, 'a call'),
      ('sub', 'qualifications', 'once', 1, 'Qualifications', 'Cualificaciones', 'setup', 'us', ARRAY['qualifications_noted'], 'and', '{}'::text[], NULL, NULL, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 2, 'their qualifications'),
      ('sub', 'w9', 'once', 2, 'W-9 in', 'W-9 recibido', 'setup', 'them', ARRAY['w9_signed'], 'and', ARRAY['w9'], NULL, NULL, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 5, NULL),
      ('sub', 'coi', 'once', 3, 'Insurance in', 'Seguro recibido', 'setup', 'them', ARRAY['coi_current'], 'and', ARRAY['coi'], NULL, NULL, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 5, NULL),
      ('sub', 'agreement', 'once', 4, 'Agreement signed', 'Acuerdo firmado', 'setup', 'them', ARRAY['sub_agreement'], 'and', '{}'::text[], NULL, NULL, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 5, NULL),
      ('sub', 'first', 'once', 5, 'First job done', 'Primer trabajo terminado', 'building', 'both', ARRAY['sub_first_done'], 'and', '{}'::text[], NULL, NULL, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
      ('sub', 'kept', 'once', 6, 'Kept or let go', 'Seguimos o no', 'building', 'us', ARRAY['sub_kept', 'sub_let_go'], 'or', '{}'::text[], NULL, NULL, true, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 30, NULL),
      ('sub', 'asked', 'per_job', 0, 'Asked', 'Ofrecido', 'pricing', 'us', ARRAY['sub_asked'], 'and', '{}'::text[], NULL, NULL, false, false, false, 'When a job of yours comes up.', 'Cuando surja un trabajo para usted.', NULL, NULL, NULL, NULL, 1, 'the work order'),
      ('sub', 'yes', 'per_job', 1, 'Said yes', 'Aceptó', 'pricing', 'them', ARRAY['sub_said_yes', 'sub_declined'], 'or', '{}'::text[], NULL, NULL, true, false, false, 'Once the work order comes.', 'Cuando llegue la orden de trabajo.', NULL, NULL, NULL, NULL, 1, NULL),
      ('sub', 'onsite', 'per_job', 2, 'On site', 'En obra', 'building', 'them', ARRAY['sub_on_site'], 'and', '{}'::text[], NULL, NULL, false, false, false, 'On the day you picked.', 'El día que eligió.', NULL, NULL, NULL, NULL, 3, NULL),
      ('sub', 'done', 'per_job', 3, 'Done', 'Terminado', 'building', 'them', ARRAY['sub_done'], 'and', '{}'::text[], NULL, NULL, false, false, false, 'When your work is finished.', 'Cuando termine su trabajo.', NULL, NULL, NULL, NULL, 5, NULL),
      ('sub', 'paid', 'per_job', 4, 'Paid', 'Pagado', 'building', 'us', ARRAY['sub_paid'], 'and', '{}'::text[], NULL, NULL, false, false, false, 'After the walkthrough.', 'Después de la revisión.', NULL, NULL, NULL, NULL, 7, 'their pay'),
      ('unknown', 'who', 'once', 0, 'Who is this?', '¿Quién es?', 'setup', 'us', ARRAY['named'], 'and', '{}'::text[], NULL, NULL, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL),
      ('candidate', 'screen', 'once', 0, 'Screening call', 'Llamada de selección', 'setup', 'us', ARRAY['cand_called'], 'and', '{}'::text[], NULL, NULL, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 3, 'a call'),
      ('candidate', 'qualifications', 'once', 1, 'Qualifications', 'Cualificaciones', 'setup', 'us', ARRAY['qualifications_noted'], 'and', '{}'::text[], NULL, NULL, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 1, 'their qualifications'),
      ('candidate', 'trial', 'once', 2, 'Try-out', 'Prueba', 'setup', 'both', ARRAY['cand_trial'], 'and', '{}'::text[], NULL, NULL, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 7, NULL),
      ('candidate', 'decided', 'once', 3, 'Hired or passed', 'Contratado o descartado', 'setup', 'us', ARRAY['cand_hired', 'cand_passed'], 'or', '{}'::text[], NULL, NULL, true, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL)
    ) AS s(kind, step_key, lane, position, name, name_es, phase, who, facts, join_word, papers, loop_words, loop_ends,
      fork, aside, skip_one_job, later_en, later_es, nudge_days, nudge_how, nudge_send, nudge_day_fact, usual, owed_words)
      ON s.kind = f.kind
    RETURNING 1
  )
  SELECT count(*) INTO added FROM seeded;
  RETURN added;
END
$$;

-- ---------- the sub flow's Once lane, where the sub flow is seeded already ----------

-- flows_seed() seeds a kind with no flow, and prod has the sub flow since R8 · 12: its new Once lane joins it here,
-- each step once (flow_steps_key_once), so a second run adds nothing.
INSERT INTO public.flow_steps (flow_id, step_key, lane, position, name, name_es, phase, who, facts, join_word, papers,
  loop_words, loop_ends, fork, aside, skip_one_job, later_en, later_es, nudge_days, nudge_how, nudge_send,
  nudge_day_fact, usual, owed_words)
SELECT f.id, s.step_key, s.lane, s.position, s.name, s.name_es, s.phase, s.who, s.facts, s.join_word, s.papers,
  s.loop_words, s.loop_ends, s.fork, s.aside, s.skip_one_job, s.later_en, s.later_es, s.nudge_days, s.nudge_how,
  s.nudge_send, s.nudge_day_fact, s.usual, s.owed_words
FROM public.flows f
JOIN (VALUES
      ('reached', 'once', 0, 'Reached out', 'Contactado', 'setup', 'us', ARRAY['sub_reached'], 'and', '{}'::text[], NULL, NULL, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 1, 'a call'),
      ('qualifications', 'once', 1, 'Qualifications', 'Cualificaciones', 'setup', 'us', ARRAY['qualifications_noted'], 'and', '{}'::text[], NULL, NULL, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 2, 'their qualifications'),
      ('w9', 'once', 2, 'W-9 in', 'W-9 recibido', 'setup', 'them', ARRAY['w9_signed'], 'and', ARRAY['w9'], NULL, NULL, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 5, NULL),
      ('coi', 'once', 3, 'Insurance in', 'Seguro recibido', 'setup', 'them', ARRAY['coi_current'], 'and', ARRAY['coi'], NULL, NULL, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 5, NULL),
      ('agreement', 'once', 4, 'Agreement signed', 'Acuerdo firmado', 'setup', 'them', ARRAY['sub_agreement'], 'and', '{}'::text[], NULL, NULL, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 5, NULL),
      ('first', 'once', 5, 'First job done', 'Primer trabajo terminado', 'building', 'both', ARRAY['sub_first_done'], 'and', '{}'::text[], NULL, NULL, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
      ('kept', 'once', 6, 'Kept or let go', 'Seguimos o no', 'building', 'us', ARRAY['sub_kept', 'sub_let_go'], 'or', '{}'::text[], NULL, NULL, true, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 30, NULL)
) AS s(step_key, lane, position, name, name_es, phase, who, facts, join_word, papers, loop_words, loop_ends,
  fork, aside, skip_one_job, later_en, later_es, nudge_days, nudge_how, nudge_send, nudge_day_fact, usual, owed_words)
  ON f.kind = 'sub'
WHERE NOT EXISTS (SELECT 1 FROM public.flow_steps x WHERE x.flow_id = f.id AND x.step_key = s.step_key);

COMMENT ON FUNCTION public.flows_seed() IS
  'Messages (cut 4, residential R4, R8 · 12 and the candidate flow): seeds the flows from SEED_FLOWS (src/lib/flows/seed.ts), only for a kind with no flow; returns the steps it added. Run by the migration; a second run adds nothing.';

REVOKE EXECUTE ON FUNCTION public.flows_seed() FROM PUBLIC, anon, authenticated;

SELECT public.flows_seed();
pdfjs-assets: copied wasm, cmaps, standard_fonts into dist/pdfjs/
todo-mockups: copied 103 mock-up page(s) under dist/to-dos
help-share-pages: wrote 436 share pages under dist/g/ with 436 cards
