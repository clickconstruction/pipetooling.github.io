commit 40b6deb2b3253ffc30981a0f007038564329e738
Author: Robert Douglas <57234112+realrobertdouglas@users.noreply.github.com>
Date:   Sat Sep 5 11:44:52 2026 -0500

    fix(sub-labor): stage Activity lines drop the doubled prefix; portal rail lights the fourth dot when pay is queued (v2.2854)
    
    - Trigger summary opens with the contractor's name (the feed row already carries the
      SUB LABOR tag); existing lines reworded in place. Migration 20260905163807.
    - Portal: a sheet at Waiting on customer with a payable-after date lights You're paid,
      chip reads Queued for <day> / Payment queued, sentence points at the date below.
      Gated on the stage so a mid-job progress promise never jumps the rail.
    - Sample fixture's second sheet now demonstrates the queued state.
    
    Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

diff --git a/docs/migrations/20260905163807_sub_stage_activity_summary.md b/docs/migrations/20260905163807_sub_stage_activity_summary.md
new file mode 100644
index 00000000..69b98f6a
--- /dev/null
+++ b/docs/migrations/20260905163807_sub_stage_activity_summary.md
@@ -0,0 +1,12 @@
+# 20260905163807_sub_stage_activity_summary
+
+**Sub sheet stages polish (v2.2854)** — the stage → Activity line drops its "Sub labor · " prefix.
+
+## What it does
+
+- `CREATE OR REPLACE FUNCTION public.people_labor_jobs_stage_to_activity()` (trigger from `20260904195443`, lookup from `20260904210406`, both unchanged): the summary now reads `<contractor>: <from> → <to>[ (from the sub portal)][ · “note”]`. `detail` is identical to before.
+- One idempotent `UPDATE` rewords the `sub_stage_change` rows already on feeds by stripping the prefix (only rows that still carry it).
+
+## Order
+
+Any time after `20260904210406`. No client or function deploy.
diff --git a/docs/recent-features/v2.2854.md b/docs/recent-features/v2.2854.md
new file mode 100644
index 00000000..8b92eb8a
--- /dev/null
+++ b/docs/recent-features/v2.2854.md
@@ -0,0 +1,8 @@
+# v2.2854 — Sub sheet stages polish: no doubled "Sub labor" on the feed, the fourth dot lights when pay is queued (2026-09-05)
+
+Owner ask after the v2.2767 / v2.2782 walkthroughs: "drop the 'Sub labor ·' prefix that repeats the tag, and light the fourth rail dot when a payable-after date is set."
+
+- **Activity summary** (migration `20260905163807_sub_stage_activity_summary.sql`): `people_labor_jobs_stage_to_activity` now opens the line with the contractor's name — `Danny Vasquez: Waiting on work → Waiting on walk-through (from the sub portal) · “note”` — since the feed row already paints the **SUB LABOR** tag. Same trigger, `CREATE OR REPLACE`; the lines already written are reworded in place (only rows still carrying the prefix). No client change: `detail` is untouched.
+- **Portal rail, fourth dot** ([`lib/subPortal/subPortalRail.ts`](../../src/lib/subPortal/subPortalRail.ts), +2 tests): `subPortalRailStep` lights **You're paid** when a sheet at *Waiting on customer* carries a payable-after date; the header chip turns green **Queued for Friday** (the pay-run day from Settings; **Payment queued** when none is set) and the sentence reads "Queued for the pay run — the date is right below," with the office's green payable-after / hold-reason line beneath as before. A payable-after date on an earlier stage (a promised progress payment mid-job) never moves the rail ahead of the work — gated on `stage === 'customer_pay'`. EN + ES strings appended to `subPortalI18n.ts`. `SheetCard` takes `payRunDayLabel` from the statement.
+- The public sample's second sheet (`/sub?t=sample`, J-1001) is at Waiting on customer with a payable-after date, so it now demonstrates the queued state.
+- Help guide `share-a-sub-their-portal.md`: the stages table gains the queued row.
diff --git a/src/content/help/share-a-sub-their-portal.md b/src/content/help/share-a-sub-their-portal.md
index 633d7afa..1ed31f8f 100644
--- a/src/content/help/share-a-sub-their-portal.md
+++ b/src/content/help/share-a-sub-their-portal.md
@@ -45,6 +45,7 @@ Every sub sheet sits at one of three stages, and the portal draws them as a four
 | {{chip:yellow|Waiting on work}} | "Finish up, then tell us below and we'll come walk it." |
 | {{chip:purple|Waiting on walk-through}} | "You told us the work's done Sep 4. We'll schedule the walk-through and let you know." |
 | {{chip:blue|Waiting on customer}} | "Passed the walk-through Sep 6. The customer's payment is the last thing between you and this money…" |
+| {{chip:blue|Waiting on customer}} + a *payable after* date | The fourth dot lights with a green {{chip:green|Queued for Friday}} chip: "Queued for the pay run — the date is right below." |
 | {{chip:green|Paid}} | The card leaves *Your jobs* — Paid sets itself when the balance hits $0. |
 
 Move a sheet from the **Stage** column on **Jobs → Sub Labor**: the **→** on the chip advances one stage, and clicking the chip opens all three so you can jump or step back. The same control sits in the sheet editor's *Shown on the sub's portal* box.
diff --git a/src/content/releaseNotes/v2.2854.ts b/src/content/releaseNotes/v2.2854.ts
new file mode 100644
index 00000000..a1a409d1
--- /dev/null
+++ b/src/content/releaseNotes/v2.2854.ts
@@ -0,0 +1,14 @@
+import type { ReleaseNote } from '../../lib/releaseNotes'
+
+const note: ReleaseNote = {
+  version: 'v2.2854',
+  date: '2026-09-05',
+  title: 'Sub sheet stages: cleaner Activity lines, and the fourth dot lights when pay is queued',
+  kind: 'fix',
+  highlights: [
+    "Stage moves on the job's Activity feed now start with the sub's name instead of repeating the Sub labor tag.",
+    "On the sub's portal, a sheet at Waiting on customer with a payable-after date lights the You're paid dot and shows a green Queued for Friday chip, so the sub can see the calendar is all that's left.",
+  ],
+}
+
+export default note
diff --git a/src/lib/subPortal/subPortalI18n.ts b/src/lib/subPortal/subPortalI18n.ts
index 15f442ad..fd03c602 100644
--- a/src/lib/subPortal/subPortalI18n.ts
+++ b/src/lib/subPortal/subPortalI18n.ts
@@ -132,6 +132,13 @@ const STRINGS = {
     en: "Thanks — we'll schedule the walk-through and let you know.",
     es: 'Gracias — programaremos la revisión y le avisamos.',
   },
+  // v2.2854: the fourth dot — a sheet at Waiting on customer with a payable-after date
+  chipQueued: { en: 'Queued for {day}', es: 'En la corrida del {day}' },
+  chipQueuedNoDay: { en: 'Payment queued', es: 'Pago en cola' },
+  stageQueuedLine: {
+    en: 'Queued for the pay run — the date is right below.',
+    es: 'En cola para la corrida de pago — la fecha está justo abajo.',
+  },
   // ── Sheet work orders (v2.2789): exclusions, referenced documents, confirmations, the signed record ──
   exclusionsLabel: { en: 'Not included', es: 'No incluido' },
   attachedByReference: { en: 'Also part of this work order', es: 'También forma parte de esta orden' },
diff --git a/src/lib/subPortal/subPortalRail.test.ts b/src/lib/subPortal/subPortalRail.test.ts
new file mode 100644
index 00000000..d711f61b
--- /dev/null
+++ b/src/lib/subPortal/subPortalRail.test.ts
@@ -0,0 +1,19 @@
+import { describe, expect, it } from 'vitest'
+import { isSubPortalSheetQueued, subPortalRailStep } from './subPortalRail'
+
+describe('subPortalRailStep', () => {
+  it('follows the stored stage for the first three dots', () => {
+    expect(subPortalRailStep({ stage: 'working', payableAfter: null })).toBe(0)
+    expect(subPortalRailStep({ stage: 'walkthrough', payableAfter: null })).toBe(1)
+    expect(subPortalRailStep({ stage: 'customer_pay', payableAfter: null })).toBe(2)
+  })
+
+  it('lights the fourth dot only for Waiting on customer with a payable-after date', () => {
+    expect(subPortalRailStep({ stage: 'customer_pay', payableAfter: '2026-09-11' })).toBe(3)
+    expect(isSubPortalSheetQueued({ stage: 'customer_pay', payableAfter: '2026-09-11' })).toBe(true)
+    // A promised progress payment mid-job never jumps the rail ahead of the work.
+    expect(subPortalRailStep({ stage: 'working', payableAfter: '2026-09-04' })).toBe(0)
+    expect(subPortalRailStep({ stage: 'walkthrough', payableAfter: '2026-09-09' })).toBe(1)
+    expect(isSubPortalSheetQueued({ stage: 'customer_pay', payableAfter: '  ' })).toBe(false)
+  })
+})
diff --git a/src/lib/subPortal/subPortalRail.ts b/src/lib/subPortal/subPortalRail.ts
new file mode 100644
index 00000000..167609d6
--- /dev/null
+++ b/src/lib/subPortal/subPortalRail.ts
@@ -0,0 +1,30 @@
+import type { SubPortalSheet } from './subPortalPayload'
+
+/**
+ * Which dot of the portal's four-dot rail is lit (v2.2767 / v2.2854):
+ *
+ *   0 Work · 1 Walk-through · 2 Customer pays · 3 You're paid
+ *
+ * The first three follow the stored stage. The fourth lights when a sheet at
+ * Waiting on customer carries a payable-after date — the office has promised
+ * a pay run, so the last thing between the sub and the money is the calendar,
+ * not the customer. A payable-after date on an earlier stage (a progress
+ * payment promised mid-job) never jumps the rail ahead of the work.
+ */
+export type SubPortalRailStep = 0 | 1 | 2 | 3
+
+export function isSubPortalSheetQueued(sheet: Pick<SubPortalSheet, 'stage' | 'payableAfter'>): boolean {
+  return sheet.stage === 'customer_pay' && (sheet.payableAfter ?? '').trim() !== ''
+}
+
+export function subPortalRailStep(sheet: Pick<SubPortalSheet, 'stage' | 'payableAfter'>): SubPortalRailStep {
+  if (isSubPortalSheetQueued(sheet)) return 3
+  switch (sheet.stage) {
+    case 'walkthrough':
+      return 1
+    case 'customer_pay':
+      return 2
+    default:
+      return 0
+  }
+}
diff --git a/src/pages/SubPortal.tsx b/src/pages/SubPortal.tsx
index 4d8ebaa1..fecd5b24 100644
--- a/src/pages/SubPortal.tsx
+++ b/src/pages/SubPortal.tsx
@@ -17,6 +17,7 @@ import {
   type SubPortalLang,
   type SubPortalStringKey,
 } from '../lib/subPortal/subPortalI18n'
+import { isSubPortalSheetQueued, subPortalRailStep } from '../lib/subPortal/subPortalRail'
 import {
   parseSubPortalPayload,
   type SubPortalDoc,
@@ -393,7 +394,15 @@ function SubPortalStatement({
         <p style={{ fontSize: 13.5, color: MUTED, marginTop: 12 }}>{t('noOpenJobs')}</p>
       ) : (
         payload.sheets.map((sheet) => (
-          <SheetCard key={sheet.id} sheet={sheet} lang={lang} t={t} submitToken={submitToken} preparedOn={payload.preparedOn} />
+          <SheetCard
+            key={sheet.id}
+            sheet={sheet}
+            lang={lang}
+            t={t}
+            submitToken={submitToken}
+            preparedOn={payload.preparedOn}
+            payRunDayLabel={payRunDayLabel}
+          />
         ))
       )}
 
@@ -584,12 +593,14 @@ function SheetCard({
   t,
   submitToken,
   preparedOn,
+  payRunDayLabel,
 }: {
   sheet: SubPortalSheet
   lang: SubPortalLang
   t: T
   submitToken: string
   preparedOn: string
+  payRunDayLabel: string | null
 }) {
   const [stage, setStage] = useState(sheet.stage)
   const [stageChangedOn, setStageChangedOn] = useState(sheet.stageChangedOn)
@@ -602,17 +613,22 @@ function SheetCard({
   if (sheet.payableAfter) payWhenParts.push(t('payableAfter', { date: formatSubPortalDate(sheet.payableAfter, lang) }))
   if (sheet.payHoldReason) payWhenParts.push(sheet.payHoldReason)
 
-  const stageIndex = stage === 'working' ? 0 : stage === 'walkthrough' ? 1 : 2
+  // The fourth dot (v2.2854): Waiting on customer + a payable-after date = the
+  // office has promised a pay run; the calendar is all that is left.
+  const queued = isSubPortalSheetQueued({ stage, payableAfter: sheet.payableAfter })
+  const stageIndex = subPortalRailStep({ stage, payableAfter: sheet.payableAfter })
   const railLabels = [t('railWork'), t('railWalk'), t('railCustomer'), t('railPaid')]
-  const chip =
-    stage === 'working'
+  const chip = queued
+    ? { label: payRunDayLabel ? t('chipQueued', { day: payRunDayLabel }) : t('chipQueuedNoDay'), bg: '#e8f3ea', fg: PAPER_GREEN }
+    : stage === 'working'
       ? { label: t('inProgress'), bg: '#e7effa', fg: '#1d4e89' }
       : stage === 'walkthrough'
         ? { label: t('chipWalk'), bg: '#f6e6d8', fg: COPPER }
         : { label: t('chipCustomer'), bg: '#f6e6d8', fg: COPPER }
   const changedLabel = stageChangedOn ? formatSubPortalDate(stageChangedOn, lang) : null
-  const sentence =
-    stage === 'working'
+  const sentence = queued
+    ? t('stageQueuedLine')
+    : stage === 'working'
       ? t('stageWorkingLine')
       : stage === 'walkthrough'
         ? stageSource === 'portal' && changedLabel
diff --git a/supabase/functions/_shared/customerSampleFixtures.ts b/supabase/functions/_shared/customerSampleFixtures.ts
index dc917088..77993510 100644
--- a/supabase/functions/_shared/customerSampleFixtures.ts
+++ b/supabase/functions/_shared/customerSampleFixtures.ts
@@ -196,7 +196,7 @@ export function sampleSubPortalResponse(company: SamplePortalCompany, todayYmd:
         backcharges: 0,
         open: 900,
         payableAfter: ymdPlusDays(todayYmd, 5),
-        payHoldReason: 'Final walk-through scheduled — we pay you as soon as the work is accepted.',
+        payHoldReason: 'Customer paid — this goes out on the next pay run.',
       },
     ],
     payments: [
diff --git a/supabase/migrations/20260905163807_sub_stage_activity_summary.sql b/supabase/migrations/20260905163807_sub_stage_activity_summary.sql
new file mode 100644
index 00000000..2e398bf1
--- /dev/null
+++ b/supabase/migrations/20260905163807_sub_stage_activity_summary.sql
@@ -0,0 +1,76 @@
+SET lock_timeout = '3s';
+
+-- Sub sheet stages polish (v2.2854): the Activity line's summary began with
+-- "Sub labor · ", which repeats the SUB LABOR tag the feed already paints on
+-- the row. Drop the prefix — the line now opens with the contractor's name.
+-- Same trigger and binding as 20260904195443 / 20260904210406; CREATE OR
+-- REPLACE swaps the body. The handful of lines already written are reworded
+-- in place (idempotent: only rows still carrying the prefix change).
+
+CREATE OR REPLACE FUNCTION public.people_labor_jobs_stage_to_activity()
+RETURNS trigger
+LANGUAGE plpgsql
+SECURITY DEFINER
+SET search_path = public
+AS $$
+DECLARE
+  v_key text;
+  v_job_id uuid;
+  v_who text;
+  v_summary text;
+BEGIN
+  v_key := lower(btrim(coalesce(NEW.job_number, '')));
+  IF v_key = '' THEN
+    RETURN NEW;
+  END IF;
+
+  -- HCP number first (the legacy key), then the click number — never an
+  -- empty-string match on either side.
+  SELECT j.id INTO v_job_id
+  FROM public.jobs_ledger j
+  WHERE lower(btrim(coalesce(j.hcp_number, ''))) = v_key
+  ORDER BY j.created_at DESC NULLS LAST
+  LIMIT 1;
+  IF v_job_id IS NULL THEN
+    SELECT j.id INTO v_job_id
+    FROM public.jobs_ledger j
+    WHERE lower(btrim(coalesce(j.click_number, ''))) = v_key
+    ORDER BY j.created_at DESC NULLS LAST
+    LIMIT 1;
+  END IF;
+  IF v_job_id IS NULL THEN
+    RETURN NEW;
+  END IF;
+
+  v_who := coalesce(nullif(btrim(NEW.assigned_to_name), ''), 'Sub');
+  v_summary := v_who || ': '
+    || public.sub_sheet_stage_label(OLD.stage) || ' → ' || public.sub_sheet_stage_label(NEW.stage)
+    || CASE WHEN NEW.stage_source = 'portal' THEN ' (from the sub portal)' ELSE '' END
+    || CASE WHEN NEW.stage_note IS NOT NULL AND NEW.stage_note <> '' THEN ' · “' || NEW.stage_note || '”' ELSE '' END;
+
+  INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
+  VALUES (
+    v_job_id,
+    'sub_stage_change',
+    coalesce(NEW.stage_changed_at, now()),
+    coalesce(NEW.stage_changed_by, CASE WHEN NEW.stage_source = 'office' THEN auth.uid() ELSE NULL END),
+    v_summary,
+    jsonb_build_object(
+      'source_id', NEW.id,
+      'from', OLD.stage,
+      'to', NEW.stage,
+      'source', NEW.stage_source,
+      'contractor', NEW.assigned_to_name,
+      'note', NEW.stage_note
+    ),
+    false
+  );
+  RETURN NEW;
+END;
+$$;
+
+-- Reword the lines already on feeds (job 1004's two, and any written since).
+UPDATE public.job_activity_events
+SET summary = substr(summary, length('Sub labor · ') + 1)
+WHERE event_type = 'sub_stage_change'
+  AND summary LIKE 'Sub labor · %';
