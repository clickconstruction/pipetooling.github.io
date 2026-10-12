SET lock_timeout = '3s';

-- Messages, cut 8 (the portals), the customer's page (to-dos/gc-mode/messages/BUILD_PLAN.md on branch spike/gc-mode;
-- the prototype's v1.162 to v1.165): what the page needs from the database before its screens. Three pieces, none of
-- which waits on cut 1's messages table.
--
--   1. A view per paper. public_page_views gains paper_kind and paper_id, written under a surface of its own,
--      portal_paper, with entity_id the customer as for portal. A paper open is not a page load: every reader of the
--      table counts surface = 'portal' rows as loads (the globe's "Opened N times" in customer-portal, the usage
--      readout's usage_customer_views, journey_health_counts), so a paper row under portal would inflate all three.
--      Its own surface leaves them true without touching them, and keeps one trail with one rule for who counts
--      (outside opens only; staff looks and previews never), rather than a second table with the same columns.
--      customer_portal_views reads it back for the office: per customer, the page and each paper, first and last open.
--   2. customer_page_words: every sentence of ours on the customer's page in English and Spanish (Settings → Customer
--      page), seeded from src/lib/portal/pageWords.ts. The office edits a sentence and keeps its blanks; who edited it
--      and when are the table's to stamp. A later seed follows the code only for sentences nobody edited.
--   3. Three switches per job on gc_projects, each off until the office turns it on: the customer sees photos, the
--      next pay application's size, and Spanish (off until a native speaker reads the portal's Spanish, as main's
--      PORTAL_SPANISH_ON holds the trade portal's).
--
-- The customer-portal edge function starts writing portal_paper rows and reading the words and switches with the
-- page's screens. The portal's write that lands a customer's note in the thread waits on cut 1's messages table.

-- 1 · A view per paper ------------------------------------------------------------------------------------------------

ALTER TABLE public.public_page_views ADD COLUMN IF NOT EXISTS paper_kind text;
ALTER TABLE public.public_page_views ADD COLUMN IF NOT EXISTS paper_id uuid;
COMMENT ON COLUMN public.public_page_views.paper_kind IS
  'Messages cut 8: on a portal_paper row, which paper the customer opened on their page: contract (gc_owner_contract_sends), change_order (gc_change_orders) or pay_app (gc_owner_pay_apps). NULL on every other surface.';
COMMENT ON COLUMN public.public_page_views.paper_id IS
  'Messages cut 8: on a portal_paper row, the opened paper''s own id in its table. No FK on purpose, as entity_id: a removed paper must not erase that it was read.';

-- Both checks go on unchecked and are then checked under the lighter lock, so the portals keep writing while the
-- existing rows are read.
ALTER TABLE public.public_page_views DROP CONSTRAINT IF EXISTS public_page_views_surface_check;
ALTER TABLE public.public_page_views ADD CONSTRAINT public_page_views_surface_check
  CHECK (surface IN ('portal', 'estimate_terms', 'contract_accept', 'hazmat_notice', 'sub_portal', 'legal_portal', 'gc_trade_portal', 'portal_paper'))
  NOT VALID;
ALTER TABLE public.public_page_views VALIDATE CONSTRAINT public_page_views_surface_check;

-- A paper row names its paper; no other row does. Every branch is true or false, never NULL, which a CHECK lets by.
ALTER TABLE public.public_page_views DROP CONSTRAINT IF EXISTS public_page_views_paper_check;
ALTER TABLE public.public_page_views ADD CONSTRAINT public_page_views_paper_check CHECK (
  CASE WHEN surface = 'portal_paper'
    THEN paper_kind IS NOT NULL AND paper_kind IN ('contract', 'change_order', 'pay_app') AND paper_id IS NOT NULL AND entity_id IS NOT NULL
    ELSE paper_kind IS NULL AND paper_id IS NULL
  END
) NOT VALID;
ALTER TABLE public.public_page_views VALIDATE CONSTRAINT public_page_views_paper_check;

-- What the office reads back about a customer's page: per customer, one row for the page (paper_kind NULL) and one
-- per paper, with the first and last outside open and how many. The office team's; anyone else gets no rows. The
-- (surface, entity_id, occurred_at) index the trail already has serves it.
CREATE OR REPLACE FUNCTION public.customer_portal_views(p_customer_ids uuid[])
RETURNS TABLE (
  customer_id uuid,
  paper_kind text,
  paper_id uuid,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  opens integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.entity_id, v.paper_kind, v.paper_id, min(v.occurred_at), max(v.occurred_at), count(*)::int
  FROM public.public_page_views v
  WHERE v.surface IN ('portal', 'portal_paper')
    AND v.entity_id = ANY (coalesce(p_customer_ids, '{}'::uuid[]))
    AND coalesce(v.viewer, 'outside') = 'outside'
    AND (SELECT public.gc_office_team())
  GROUP BY v.entity_id, v.paper_kind, v.paper_id
  ORDER BY v.entity_id, v.paper_kind NULLS FIRST, min(v.occurred_at);
$$;
COMMENT ON FUNCTION public.customer_portal_views(uuid[]) IS
  'Messages cut 8: the office''s read-back of customers'' pages (the thread''s portal pill, the step card''s So far, Follow up''s portal rows, By company''s Portal column). Per customer: the page (paper_kind NULL) and each paper opened, first and last outside open and the count. gc_office_team() only.';
REVOKE ALL ON FUNCTION public.customer_portal_views(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_views(uuid[]) TO authenticated, service_role;

-- 2 · The customer page's words ---------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customer_page_words (
  -- pageWords.ts's key; a paper's words are paper.<id>.<field>.
  key text PRIMARY KEY
    CONSTRAINT customer_page_words_key_shape CHECK (key ~ '^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)*$'),
  en text NOT NULL
    CONSTRAINT customer_page_words_en_said CHECK (length(btrim(en)) BETWEEN 1 AND 400),
  es text NOT NULL
    CONSTRAINT customer_page_words_es_said CHECK (length(btrim(es)) BETWEEN 1 AND 400),
  edited_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  edited_at timestamptz
);

COMMENT ON TABLE public.customer_page_words IS
  'Messages cut 8: every sentence of ours on the customer''s page in English and Spanish (Settings → Customer page), seeded from src/lib/portal/pageWords.ts. The office edits en and es and keeps the sentence''s {blanks}; edited_by and edited_at are stamped by the table. A later seed follows the code only where edited_at is NULL. The page reads a sentence here and falls back to the code for a key this table lacks.';

-- The {blanks} of a sentence, sorted: the code fills them, so an edit keeps them.
CREATE OR REPLACE FUNCTION public.customer_page_word_blanks(t text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(array_agg(DISTINCT m[1] ORDER BY m[1]), '{}'::text[]) FROM regexp_matches(t, '\{(\w+)\}', 'g') AS m;
$$;

-- An edit by a signed-in user keeps the blanks the sentence shipped with, in both languages, and is stamped with who
-- and when. A seed from a migration (no signed-in user) passes untouched and unstamped.
CREATE OR REPLACE FUNCTION public.customer_page_words_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_blanks text[] := public.customer_page_word_blanks(OLD.en);
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.customer_page_word_blanks(NEW.en) IS DISTINCT FROM v_blanks
     OR public.customer_page_word_blanks(NEW.es) IS DISTINCT FROM v_blanks THEN
    RAISE EXCEPTION 'customer_page_words: an edit keeps the sentence''s blanks: %',
      CASE WHEN cardinality(v_blanks) = 0 THEN 'none' ELSE '{' || array_to_string(v_blanks, '}, {') || '}' END
      USING ERRCODE = 'check_violation';
  END IF;
  NEW.edited_by := v_uid;
  NEW.edited_at := clock_timestamp();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS customer_page_words_edit ON public.customer_page_words;
CREATE TRIGGER customer_page_words_edit BEFORE UPDATE ON public.customer_page_words
  FOR EACH ROW EXECUTE FUNCTION public.customer_page_words_edit();

ALTER TABLE public.customer_page_words ENABLE ROW LEVEL SECURITY;

-- The office team reads and edits, under one policy as door 2 gave each of its tables.
DROP POLICY IF EXISTS customer_page_words_team ON public.customer_page_words;
CREATE POLICY customer_page_words_team ON public.customer_page_words FOR ALL TO authenticated
  USING ((SELECT public.gc_office_team())) WITH CHECK ((SELECT public.gc_office_team()));

-- Nobody signed out reaches it. Signed in: read, and change a sentence's two languages. The keys come from the code
-- and the seed, so no client adds or takes away a sentence; who edited and when are the trigger's.
REVOKE ALL ON TABLE public.customer_page_words FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.customer_page_words FROM authenticated;
GRANT SELECT ON TABLE public.customer_page_words TO authenticated;
GRANT UPDATE (en, es) ON TABLE public.customer_page_words TO authenticated;

-- customer_page_words seed: begin (written by scripts/customer-page-words-sql.ts; never edit by hand)
INSERT INTO public.customer_page_words (key, en, es) VALUES
  ('switchLang', 'Español', 'English'),
  ('offThanks', 'Thank you for considering us. If you need us again, text us.', 'Gracias por considerarnos. Si vuelve a necesitarnos, escríbanos.'),
  ('onIt', 'We are on it.', 'Estamos en ello.'),
  ('later', 'Later.', 'Después.'),
  ('doneWord', 'done', 'listo'),
  ('dueOn', 'due {day}', 'para el {day}'),
  ('lateSince', 'late since {day}', 'atrasado desde el {day}'),
  ('yourMove', 'Your move.', 'Le toca a usted.'),
  ('afterStep', 'After {step}.', 'Después de {step}.'),
  ('sendBy', 'We send it to you by {day}.', 'Se lo enviamos para el {day}.'),
  ('ranOut', '{paper} ran out.', '{paper} venció.'),
  ('sayYesNo', 'Say yes or no here.', 'Diga sí o no aquí.'),
  ('tellUsYesNo', 'Tell us yes or no', 'Díganos sí o no'),
  ('acceptBid', 'Accept the bid', 'Aceptar la oferta'),
  ('notThisTime', 'Not this time', 'Esta vez no'),
  ('waitCertificate', 'Waiting on your architect for the certificate.', 'Esperando el certificado de su arquitecto.'),
  ('waitArchitect', 'Waiting on your architect.', 'Esperando a su arquitecto.'),
  ('waitOwner', 'Waiting on the owner.', 'Esperando al dueño.'),
  ('waitOther', 'Waiting on someone else first.', 'Esperando a otra persona primero.'),
  ('withCompany', 'with {company}', 'con {company}'),
  ('tabHome', 'Home', 'Inicio'),
  ('tabMoney', 'Money', 'Dinero'),
  ('tabSchedule', 'Schedule', 'Calendario'),
  ('tabPapers', 'Papers', 'Documentos'),
  ('tabMessages', 'Messages', 'Mensajes'),
  ('yourMoveTitle', 'Your move', 'Le toca a usted'),
  ('nothingToday', 'Nothing from you today.', 'Hoy no necesitamos nada de usted.'),
  ('weAreOn', 'We are on {step}.', 'Estamos en {step}.'),
  ('whereTitle', 'Where you are', 'Dónde está'),
  ('whereCount', '{done} of {total} done', '{done} de {total} listos'),
  ('allSteps', 'All {n} steps', 'Los {n} pasos'),
  ('fewer', 'Fewer', 'Menos'),
  ('weekTitle', 'This week', 'Esta semana'),
  ('everyFriday', 'Every Friday.', 'Cada viernes.'),
  ('peopleTitle', 'Your people', 'Sus contactos'),
  ('changeWaits', 'Change order {n} waits on your answer', 'La orden de cambio {n} espera su respuesta'),
  ('readAndSign', 'Read and sign', 'Leer y firmar'),
  ('decline', 'Decline', 'Rechazar'),
  ('addsNoDays', 'adds no days', 'no agrega días'),
  ('addsOneDay', 'adds 1 working day', 'agrega 1 día hábil'),
  ('addsDays', 'adds {n} working days', 'agrega {n} días hábiles'),
  ('creditOf', 'a credit of {amount}', 'un crédito de {amount}'),
  ('waitingAnswer', 'Waiting on your answer', 'Esperando su respuesta'),
  ('signingAdds', 'Signing it adds it to the sum. Declining it changes nothing.', 'Firmarla la agrega a la suma. Rechazarla no cambia nada.'),
  ('builtPct', '{pct}% built', '{pct}% construido'),
  ('investedOf', '{paid} of {sum} invested', '{paid} de {sum} invertido'),
  ('paidOnTime', '{n} of {n} paid on time', '{n} de {n} pagadas a tiempo'),
  ('startingTitle', 'Getting started', 'Para empezar'),
  ('soFarOf', '{paid} of {sum} so far', '{paid} de {sum} hasta ahora'),
  ('firstAppAbout', 'first pay application about {day}', 'primera solicitud de pago cerca del {day}'),
  ('sumIsNone', 'The sum is your contract. Nothing else.', 'La suma es su contrato. Nada más.'),
  ('sumIsOne', 'The sum is your contract plus the one change you signed. Nothing else.', 'La suma es su contrato más el cambio que firmó. Nada más.'),
  ('sumIsMany', 'The sum is your contract plus the {n} changes you signed. Nothing else.', 'La suma es su contrato más los {n} cambios que firmó. Nada más.'),
  ('howPayTitle', 'How paying works', 'Cómo funciona el pago'),
  ('howPayWords', 'Once a month we send a pay application for that month''s work, with photos. Your architect certifies it. Then it is due in {days} days. Every one comes with a lien waiver from every trade we paid.', 'Una vez al mes enviamos una solicitud de pago por el trabajo de ese mes, con fotos. Su arquitecto la certifica. Luego vence en {days} días. Cada una trae una renuncia de gravamen de cada oficio que pagamos.'),
  ('howPayWordsNoDays', 'Once a month we send a pay application for that month''s work, with photos. Your architect certifies it. Every one comes with a lien waiver from every trade we paid.', 'Una vez al mes enviamos una solicitud de pago por el trabajo de ese mes, con fotos. Su arquitecto la certifica. Cada una trae una renuncia de gravamen de cada oficio que pagamos.'),
  ('payAppN', 'Pay application {n}', 'Solicitud de pago {n}'),
  ('paidOnDay', 'paid {day}', 'pagada el {day}'),
  ('withArchitect', 'With your architect, {name}, for the certificate since {day}.', 'Con su arquitecto, {name}, para el certificado desde el {day}.'),
  ('withArchitectUnnamed', 'With your architect for the certificate since {day}.', 'Con su arquitecto para el certificado desde el {day}.'),
  ('dueDaysAfter', 'Due {days} days after it.', 'Vence {days} días después.'),
  ('nothingYet', 'Nothing to do yet.', 'Nada que hacer por ahora.'),
  ('certifiedBy', 'Certified by {name}, {day}.', 'Certificada por {name}, el {day}.'),
  ('dueOnDay', 'Due {day}.', 'Vence el {day}.'),
  ('waiversOne', '1 lien waiver, the trade on it paid {day}', '1 renuncia de gravamen, el oficio pagado el {day}'),
  ('waiversMany', '{n} lien waivers, every trade on it paid {day}', '{n} renuncias de gravamen, cada oficio pagado el {day}'),
  ('thankYou', 'Thank you', 'Gracias'),
  ('thankYouSmall', 'thank you', 'gracias'),
  ('receipt', 'Receipt', 'Recibo'),
  ('waiversButton', 'Waivers', 'Renuncias'),
  ('payIt', 'Pay it', 'Pagar'),
  ('readApp', 'Read the application', 'Leer la solicitud'),
  ('olderPaid', 'Pay applications {list}, paid', 'Solicitudes de pago {list}, pagadas'),
  ('and', ' and ', ' y '),
  ('afterThatTitle', 'After that', 'Después'),
  ('afterRange', 'roughly {low} to {high}, about {day}', 'aproximadamente {low} a {high}, cerca del {day}'),
  ('afterAbout', 'about {amount}, around {day}', 'cerca de {amount}, alrededor del {day}'),
  ('sizesNote', 'Sizes follow the schedule. The real number comes with the application.', 'Los montos siguen el calendario. La cifra real llega con la solicitud.'),
  ('historyTitle', 'History', 'Historial'),
  ('contractSigned', 'Contract signed', 'Contrato firmado'),
  ('payAppPaid', 'Pay application {n} paid', 'Solicitud de pago {n} pagada'),
  ('changeSigned', 'Change order {n} signed', 'Orden de cambio {n} firmada'),
  ('tradesPaidOne', '1 trade paid {day}', '1 oficio pagado el {day}'),
  ('tradesPaidMany', '{n} trades paid {day}', '{n} oficios pagados el {day}'),
  ('withArchitectSince', 'with your architect since {day}', 'con su arquitecto desde el {day}'),
  ('aboutDay', 'about {day}', 'cerca del {day}'),
  ('investedSoFar', 'Invested so far', 'Invertido hasta ahora'),
  ('toFinish', 'To finish', 'Por terminar'),
  ('statementTitle', 'The statement', 'El estado de cuenta'),
  ('lineContract', 'Contract', 'Contrato'),
  ('lineChanges', 'Changes signed', 'Cambios firmados'),
  ('lineRevised', 'Revised sum', 'Suma revisada'),
  ('lineBilled', 'Billed so far', 'Facturado'),
  ('linePaid', 'Paid so far', 'Pagado'),
  ('lineBalance', 'Balance to finish', 'Saldo por terminar'),
  ('payNoteCard', 'Pay by bank transfer at no fee, or by card with a {fee} fee. The details are on each bill.', 'Pague por transferencia sin cargo, o con tarjeta con un cargo del {fee}. Los datos van en cada factura.'),
  ('payNoteBank', 'Pay by bank transfer at no fee. The details are on each bill.', 'Pague por transferencia sin cargo. Los datos van en cada factura.'),
  ('signedTitle', 'Signed', 'Firmados'),
  ('signedOn', 'signed {day}', 'firmado el {day}'),
  ('readCopy', 'Read or save a copy', 'Leer o guardar una copia'),
  ('waitingOnYou', 'Waiting on you', 'Esperando por usted'),
  ('signBy', 'Sign by {day}.', 'Fírmelo antes del {day}.'),
  ('comesLater', 'Comes later', 'Vienen después'),
  ('laterPayApps', 'Pay applications', 'Solicitudes de pago'),
  ('laterPayAppsWhen', 'one a month, with the architect''s certificate', 'una al mes, con el certificado del arquitecto'),
  ('laterWaivers', 'Lien waivers', 'Renuncias de gravamen'),
  ('laterWaiversWhen', 'one per payment', 'una por pago'),
  ('laterBinder', 'Closeout binder', 'Carpeta de cierre'),
  ('laterBinderWhen', 'warranties, manuals, as-builts, at the end', 'garantías, manuales, planos finales, al terminar'),
  ('everyPaper', 'Every paper here is also in the email we sent it in.', 'Cada documento aquí también está en el correo con el que se lo enviamos.'),
  ('changeOrderN', 'Change order {n}', 'Orden de cambio {n}'),
  ('milestones', 'Milestones', 'Hitos'),
  ('whatMoved', 'What moved', 'Qué se movió'),
  ('nothingMoved', 'Nothing has moved since the schedule went.', 'Nada se ha movido desde que salió el calendario.'),
  ('nothingYetShort', 'Nothing yet.', 'Aún nada.'),
  ('messagesSame', 'The same conversation as your texts and emails with us. Write here, by text or by email. It all lands in one place.', 'La misma conversación que sus mensajes y correos con nosotros. Escriba aquí, por mensaje o por correo. Todo llega al mismo lugar.'),
  ('you', 'You', 'Usted'),
  ('writeToUs', 'Write to us…', 'Escríbanos…'),
  ('send', 'Send', 'Enviar'),
  ('repliesHours', 'Replies come from the office in business hours. For something urgent on site, call {name}.', 'Las respuestas salen de la oficina en horario de trabajo. Para algo urgente en obra, llame a {name}.'),
  ('doorHere', 'here', 'aquí'),
  ('doorText', 'by text', 'por mensaje'),
  ('doorEmail', 'by email', 'por correo'),
  ('paper.msa.label', 'Master agreement', 'Acuerdo marco'),
  ('paper.msa.why', 'Read it and sign it here.', 'Léalo y fírmelo aquí.'),
  ('paper.msa.button', 'Sign the agreement', 'Firme el acuerdo'),
  ('paper.msa.onIt', 'We are getting it ready. You sign it here.', 'Lo estamos preparando. Lo firma aquí.'),
  ('paper.msa.comes', 'We send it once your certificate is in. You sign it here.', 'Se lo enviamos cuando llegue su certificado. Lo firma aquí.'),
  ('paper.bid.label', 'Our bid', 'Nuestra oferta'),
  ('paper.bid.onIt', 'We are working on your number.', 'Estamos preparando su número.'),
  ('paper.contract.label', 'Our contract', 'Nuestro contrato'),
  ('paper.contract.why', 'Read it and sign it here.', 'Léalo y fírmelo aquí.'),
  ('paper.contract.button', 'Sign the contract', 'Firme el contrato'),
  ('paper.contract.onIt', 'We are getting it ready. You sign it here.', 'Lo estamos preparando. Lo firma aquí.'),
  ('paper.contract.comes', 'We send it once you say yes.', 'Se lo enviamos cuando acepte.'),
  ('paper.schedule.label', 'Start date letter', 'Carta de fecha de inicio'),
  ('paper.schedule.onIt', 'We are setting your start date.', 'Estamos fijando su fecha de inicio.'),
  ('paper.schedule.comes', 'We send your start date once the contract is signed.', 'Le enviamos la fecha de inicio cuando el contrato esté firmado.'),
  ('paper.payapp.label', 'Pay application', 'Solicitud de pago'),
  ('paper.payapp.why', 'Pay by the day on it.', 'Pague para la fecha indicada.'),
  ('paper.payapp.button', 'See the pay application', 'Ver la solicitud de pago'),
  ('paper.co.label', 'Change order', 'Orden de cambio'),
  ('paper.co.why', 'Sign it or decline it here.', 'Fírmela o recházela aquí.'),
  ('paper.co.button', 'See the change order', 'Ver la orden de cambio')
ON CONFLICT (key) DO UPDATE SET en = EXCLUDED.en, es = EXCLUDED.es
  WHERE public.customer_page_words.edited_at IS NULL;
-- customer_page_words seed: end

-- 3 · The switches per job ------------------------------------------------------------------------------------------

ALTER TABLE public.gc_projects
  ADD COLUMN IF NOT EXISTS portal_photos_on boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS portal_forecast_on boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS portal_spanish_on boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.gc_projects.portal_photos_on IS
  'Messages cut 8: the customer''s page shows the photos marked for them (This week, each pay application). Off until the office turns it on: some owners share the link with tenants.';
COMMENT ON COLUMN public.gc_projects.portal_forecast_on IS
  'Messages cut 8: the customer''s Money tab shows After that, the next pay application sized from the billing forecast. Off until the office turns it on.';
COMMENT ON COLUMN public.gc_projects.portal_spanish_on IS
  'Messages cut 8: the customer''s page offers Español. Off until a native speaker reads the portal''s Spanish, as PORTAL_SPANISH_ON holds the trade portal''s.';

-- House rules: read-only training mode and the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
