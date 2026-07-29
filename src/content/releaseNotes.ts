import type { ReleaseNote } from '../lib/releaseNotes'

/**
 * In-app release notes (Settings → Release notes), newest first.
 *
 * Every PR adds one entry here with the SAME v2.NNN as its
 * docs/RECENT_FEATURES.md entry — src/lib/releaseNotes.test.ts fails CI when
 * the newest versions diverge. Keep entries short and user-readable: what
 * changed and where, no file paths or implementation detail (that lives in
 * RECENT_FEATURES.md).
 */
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: 'v2.1081',
    date: '2026-07-29',
    title: 'Undo in Edit Job',
    kind: 'feature',
    highlights: [
      'New "Undo changes" button in Edit Job reverts everything back to how the job looked when you opened the modal — the revert then auto-saves like any other edit.',
      'Creating or deleting an invoice sets a new restore point, so Undo never unwinds invoice work.',
      'Disabled (greyed out) until you actually change something.',
    ],
  },
  {
    version: 'v2.1080',
    date: '2026-07-29',
    title: 'Edit Job: the Save button is gone',
    kind: 'feature',
    highlights: [
      'Everything in Edit Job now saves automatically, so the Save button is retired. A status chip in the corner tells you where things stand — "All changes saved", "Saving…", or "Waiting on required fields".',
      'Closing always finishes any pending save first; if the server is slow you choose Retry, Keep editing, or Close without saving.',
      'A Paid job that ends up owing money again still moves back to Billed — that check now runs when you close the modal.',
      'New Job keeps its button, now labeled "Create Job".',
    ],
  },
  {
    version: 'v2.1079',
    date: '2026-07-29',
    title: 'Edit Job now auto-saves everything',
    kind: 'feature',
    highlights: [
      'Job details (numbers, name, address, customer info, links), Other job charges, and Team changes now save automatically about a second after you stop typing — same as line items and payments already did.',
      'Required fields (Job Name, Job Address, Service type) never save while blank — finish typing and the save catches up.',
      'The Save button still works as always; New Job still uses Create.',
    ],
  },
  {
    version: 'v2.1078',
    date: '2026-07-29',
    title: 'Groundwork for full Edit Job auto-save',
    kind: 'fix',
    highlights: [
      'Internal restructuring of how Edit Job saves line items and payments, preparing for the whole form to auto-save. No visible change yet.',
    ],
  },
  {
    version: 'v2.1077',
    date: '2026-07-29',
    title: 'Edit Job never loses a just-typed money edit on close',
    kind: 'fix',
    highlights: [
      'Closing Edit Job (Cancel, clicking outside, or jumping to Stages / Job Detail) now saves any line-item or payment edit that was still waiting to auto-save, instead of silently dropping it.',
      'If the server does not respond, the modal stays open and asks: Retry and close, Keep editing, or Close without saving.',
      'Switching tabs or backgrounding the app mid-edit also triggers the auto-save right away.',
    ],
  },
  {
    version: 'v2.1076',
    date: '2026-07-29',
    title: 'Cleaner Make Invoice row',
    kind: 'fix',
    highlights: [
      'On narrow screens the Make Invoice controls now wrap as two clean lines — the amount and its + button stay together, and "% of job total · Quick set" stays together — instead of scattering.',
      'The "How invoices and jobs move" link drops its underline.',
    ],
  },
  {
    version: 'v2.1075',
    date: '2026-07-29',
    title: 'Make Invoice, in green',
    kind: 'fix',
    highlights: [
      '"Open Invoice" is now "Make Invoice", and its + button is green — matching the green invoice cards on Stages. Sending the whole job to Ready to Bill stays blue, like the job card it moves.',
      'The explainer sentence under the ② Invoices heading is gone.',
    ],
  },
  {
    version: 'v2.1074',
    date: '2026-07-29',
    title: 'Learn how invoices and jobs move through Stages',
    kind: 'feature',
    highlights: [
      'A small "How invoices and jobs move" link above the segment strip expands a quick guide: invoices break off as green cards that travel Ready to Bill → Billed → Paid on their own, and the blue job card floats through when its last payment lands.',
      'The examples use your actual job number and segment amounts, in the same green and blue you\'ll see on the Stages board.',
    ],
  },
  {
    version: 'v2.1073',
    date: '2026-07-29',
    title: 'Tidier Invoices section',
    kind: 'fix',
    highlights: [
      'The explainer sentence above the job-segments strip is gone — the named blocks speak for themselves. The color legend stays.',
      'The Quick set percentage buttons now tuck behind a small "Quick set" toggle next to "% of job total" — click it to reveal 20/40/60/80/Max.',
    ],
  },
  {
    version: 'v2.1072',
    date: '2026-07-29',
    title: 'Segment strip polish + delete draft invoices',
    kind: 'feature',
    highlights: [
      'The job-segments strip now shows each segment\'s name right in its colored block (trimmed with … when narrow), and the list below shows one segment per line.',
      'Click a block in the strip — it and its line below highlight together; ticking a checkbox lights up its block the same way.',
      'The Invoices table gets a red ✕ on draft invoices: press it, confirm, and the draft is deleted — any segments on it go back to unbilled instantly.',
    ],
  },
  {
    version: 'v2.1071',
    date: '2026-07-29',
    title: 'Multiple Segment Generator',
    kind: 'feature',
    highlights: [
      'New in Edit Job\'s Line Items: a Multiple Segment Generator link opens a modal where you set a total, name the segments of work, and give each a percentage — the dollar split calculates live and always adds back to your total.',
      'Two one-tap presets: Commercial 30/30/30/10 (Rough In / Top Out / Trim Set / Final) and Residential 40/40/20 (Rough In / Top Out / Trim Set).',
      '"Add to Job" appends the segments to your existing line items, ready to re-order and bill stage by stage.',
    ],
  },
  {
    version: 'v2.1070',
    date: '2026-07-29',
    title: 'See the whole job as segments — and bill them',
    kind: 'feature',
    highlights: [
      'Edit Job\'s Invoices section now opens with a colored strip showing every line item as a block — in your order, sized by its share of the job, colored by whether it\'s unbilled, ready to bill, billed, or paid.',
      'Tick the finished segments and press one button to break off a Ready-to-Bill invoice for exactly those stages.',
      'New help guide: "split a job into stages and bill stage by stage".',
    ],
  },
  {
    version: 'v2.1069',
    date: '2026-07-29',
    title: 'Line items remember which invoice bills them',
    kind: 'feature',
    highlights: [
      'When a line item has been billed by an invoice, Edit Job now shows it with an "Invoiced" tag and protects it from edits — send the invoice back or delete it to unlock the line.',
      'Re-ordering stays available on every line, billed or not.',
    ],
  },
  {
    version: 'v2.1068',
    date: '2026-07-29',
    title: 'Groundwork for billing jobs by stage',
    kind: 'infra',
    highlights: [
      'Behind-the-scenes database change that lets a job\'s line items link to the invoice that bills them. Nothing visible changes yet — the stage-billing tools land in the next updates.',
    ],
  },
  {
    version: 'v2.1067',
    date: '2026-07-28',
    title: 'Edit Job: re-order line items',
    kind: 'feature',
    highlights: [
      'Line items in Edit Job now have small up/down arrows so you can arrange them in the order the work happens — first step toward setting up line items as job stages.',
      'The order saves with the job and comes back the same way next time.',
    ],
  },
  {
    version: 'v2.1066',
    date: '2026-07-28',
    title: 'Training mode: clock in/out now works',
    kind: 'feature',
    highlights: [
      'People in read-only training mode can now clock in and clock out — their real hours keep flowing to payroll while they train.',
      'Everything else stays blocked: they can only punch their own time, and cannot edit others\' sessions, delete sessions, or approve hours.',
    ],
  },
  {
    version: 'v2.1065',
    date: '2026-07-28',
    title: 'Dispatch cards show the job address',
    kind: 'feature',
    highlights: [
      'On Dispatch (People tab), every schedule card now shows the job\'s address under the job name — always one line, trimmed with … when it\'s long. Hover for the full address.',
    ],
  },
  {
    version: 'v2.1064',
    date: '2026-07-28',
    title: 'More buttons can no longer hang on "Saving…"',
    kind: 'fix',
    highlights: [
      'The same stuck-spinner protection the Schedule window got in v2.1063 now covers posting a job note, Set % complete, moving a job between stages, all three Bill Customer submit paths, and clocking in or out.',
      'If the server stops responding mid-save, the button gives up after its deadline (15 seconds for most saves; longer for Stripe and invoice emails), re-enables, and tells you the save may or may not have landed — check before retrying.',
    ],
  },
  {
    version: 'v2.1063',
    date: '2026-07-28',
    title: 'Schedule save can no longer hang on "Saving…"',
    kind: 'fix',
    highlights: [
      'If the server stops responding mid-save, the Schedule window now gives up after 15 seconds, re-enables the button, and tells you to check the day view before retrying — instead of spinning forever.',
      'Scheduling several people is now one all-or-nothing save, so a server hiccup can never leave half the crew scheduled.',
    ],
  },
  {
    version: 'v2.1062',
    date: '2026-07-28',
    title: 'NEXT line: who first, when below',
    kind: 'fix',
    highlights: [
      'The green NEXT line on Stages rows and in the activity panel now reads "NEXT · Abraham" with "Fri Jul 31 8:00–9:30 AM" underneath — and the time drops the repeated AM/PM.',
    ],
  },
  {
    version: 'v2.1061',
    date: '2026-07-28',
    title: 'Tidier Activity column + pinned Next in the thread',
    kind: 'fix',
    highlights: [
      'On busy Stages rows, the expand arrow and note count no longer wrap onto their own lonely line — they stay glued to the time.',
      'The Job activity / notes panel now pins the job\'s Next appointment (date, time, crew, note) above the feed, in both the inline and full-screen views.',
    ],
  },
  {
    version: 'v2.1060',
    date: '2026-07-28',
    title: 'Stages shows each job\'s next appointment',
    kind: 'feature',
    highlights: [
      'The Activity column now shows a green "Next" line on every job with an upcoming schedule: date, time window, who\'s going, and the dispatch note.',
      'Click the line to open the Job Calendar for the whole plan.',
    ],
  },
  {
    version: 'v2.1059',
    date: '2026-07-28',
    title: 'Takeoff part search no longer cut off',
    kind: 'fix',
    highlights: [
      'On Bids → Takeoffs, the part-search suggestions on the last rows of the sheet were clipped at the table edge — you could only see the first result. The list now floats over whatever is below it.',
    ],
  },
  {
    version: 'v2.1058',
    date: '2026-07-28',
    title: 'Job Calendar from the Detail window and Job Mode',
    kind: 'feature',
    highlights: [
      'The calendar icon at the top of a job\'s Detail window now opens the Job Calendar (month view + appointments). Week dispatch and Schedule… are inside it, one click away — Schedule… even opens on the day you highlighted.',
      'Job Mode: a small "Job calendar" link under the job header shows techs the whole plan for the job they\'re on — read-only.',
    ],
  },
  {
    version: 'v2.1057',
    date: '2026-07-28',
    title: 'Job Calendar: pick a day, act on it',
    kind: 'feature',
    highlights: [
      'On the Job Calendar, any day is now clickable — highlight one and Schedule… opens right on that date, while Open week dispatch jumps to that week.',
      'Days with nothing scheduled or worked now show in grey, so the busy days stand out.',
    ],
  },
  {
    version: 'v2.1056',
    date: '2026-07-28',
    title: 'Job Calendar: see whose calendars a job is on',
    kind: 'feature',
    highlights: [
      'On Jobs → Stages, clicking a job\'s "j:" field-activity date now opens a Job Calendar — a month view with a colored dot for each person scheduled that day, a ✓ on days actually worked, and today outlined.',
      'Below the calendar, every appointment is listed — upcoming first, past dimmed — with times, people, and notes. Click a day to jump to it.',
      'Open week dispatch and Schedule… are right there, so you can act on what you see.',
    ],
  },
  {
    version: 'v2.1055',
    date: '2026-07-28',
    title: 'Tighter job header on full-screen activity',
    kind: 'fix',
    highlights: [
      'The full-screen Job activity / notes header is now two compact lines: "Job: 933 · PLUM · Burt Carter" on top, the address on one line below (still opens Google Maps).',
    ],
  },
  {
    version: 'v2.1054',
    date: '2026-07-28',
    title: 'Full-screen activity truly covers the screen',
    kind: 'fix',
    highlights: [
      'On phones, the full-screen Job activity / notes view was rendering under the app\'s top bar and bottom tabs, with bits of the board showing through. It now covers everything edge to edge.',
    ],
  },
  {
    version: 'v2.1053',
    date: '2026-07-28',
    title: 'Full-screen activity shows which job you\'re on',
    kind: 'feature',
    highlights: [
      'The full-screen Job activity / notes view now shows the job number, service type, job name, and address at the top — the address opens Google Maps.',
    ],
  },
  {
    version: 'v2.1052',
    date: '2026-07-28',
    title: 'Full-screen job activity on Stages',
    kind: 'feature',
    highlights: [
      'The Job activity / notes panel on Stages has a new expand button (top right) that takes it full screen — much easier to read and post notes on a phone. Press it again or hit Esc to go back.',
      'Clicking a job\'s "N Reports" button now opens that full-screen activity view directly, with the reports right there in the feed.',
    ],
  },
  {
    version: 'v2.1051',
    date: '2026-07-28',
    title: 'No more endless "Loading…" screens',
    kind: 'fix',
    highlights: [
      'If the app can\'t reach the server on startup, it now gives up after 8 seconds and shows the sign-in screen instead of hanging on "Loading…" forever.',
      'The loading screen also offers a "Taking too long? Fix the app" link, and there\'s a new help guide: fix the app when it won\'t load.',
    ],
  },
  {
    version: 'v2.1050',
    date: '2026-07-28',
    title: 'pipetooling.com/fix',
    kind: 'feature',
    highlights: [
      'Easy to remember: pipetooling.com/fix now opens the app-repair page (same as /fix-cache.html) — use it when the app is stuck on a blank or loading screen.',
    ],
  },
  {
    version: 'v2.1049',
    date: '2026-07-28',
    title: 'Cleaner Stages toolbar',
    kind: 'feature',
    highlights: [
      'The Stages bar is now just New Job, a full-width search, and a ⋯ menu holding everything else — Job Book, Total by Name, Combine / Separate, and the three toggles with On/Off states.',
    ],
  },
  {
    version: 'v2.1048',
    date: '2026-07-28',
    title: 'Cleaner report entries in the activity thread',
    kind: 'fix',
    highlights: [
      'Report entries no longer show internal ID codes as field labels, and the redundant "View full report" button is gone now that the full text shows inline.',
    ],
  },
  {
    version: 'v2.1047',
    date: '2026-07-28',
    title: 'Send back + Collections share a row',
    kind: 'fix',
    highlights: [
      'On Billed Awaiting Payment rows, "Send back" and a red "Collections" button now sit side by side instead of stacked, saving a row of height.',
    ],
  },
  {
    version: 'v2.1046',
    date: '2026-07-28',
    title: 'Full reports in the Stages activity thread',
    kind: 'feature',
    highlights: [
      'Expanding Job activity / notes now shows every report answer in full — question by question — instead of a one-line teaser.',
      '"View full report" remains for signatures and the map view.',
    ],
  },
  {
    version: 'v2.1045',
    date: '2026-07-28',
    title: 'Stages previews skip "Leaving job" stamps',
    kind: 'fix',
    highlights: [
      'The activity preview now shows the tech\'s latest real note instead of an "Arrived at job" / "Leaving job" stamp posted after it.',
      'Stamps still count and still appear in the expanded Job activity / notes thread.',
    ],
  },
  {
    version: 'v2.1044',
    date: '2026-07-28',
    title: 'Report previews read like notes on Stages',
    kind: 'fix',
    highlights: [
      'The activity preview drops the "Report: Status Report" label line — you see the report text itself, same as notes. The Reports chip still marks report activity.',
    ],
  },
  {
    version: 'v2.1043',
    date: '2026-07-28',
    title: 'Tidier activity header on Stages',
    kind: 'fix',
    highlights: [
      'The notes chevron and count now sit at the end of the "Abraham · Wed 5:02 PM (6d ago)" line instead of stacked in front of it — same toggle, more room for the note preview.',
    ],
  },
  {
    version: 'v2.1042',
    date: '2026-07-28',
    title: 'Emailed-customer hint fits small screens',
    kind: 'fix',
    highlights: [
      'The "Stripe emailed …" line on Jobs → Stages no longer spills into the next column on phones — it wraps cleanly, and the envelope icon is gone.',
    ],
  },
  {
    version: 'v2.1041',
    date: '2026-07-28',
    title: 'Tighter "Stripe emailed customer" hint on Stages',
    kind: 'fix',
    highlights: [
      'The three stacked lines under billed rows are now one compact line — "✉ Stripe emailed Mon 10:28 PM (1d)" with a small Resend beside it (hover for the full date).',
    ],
  },
  {
    version: 'v2.1040',
    date: '2026-07-28',
    title: 'Stages shows which jobs have a hazmat fee',
    kind: 'feature',
    highlights: [
      'On Jobs → Stages, the ☣ button now wears a bright green box on any job that already carries a hazmat fee — spot them at a glance.',
      'Hover it to confirm; clicking still opens the wizard to add another fee. Voided fees don’t count.',
    ],
  },
  {
    version: 'v2.1039',
    date: '2026-07-28',
    title: 'Hazmat notice email: send it when you choose',
    kind: 'feature',
    highlights: [
      'The "Also email the notice" box in Bill Customer no longer starts checked — the notice email only goes out when you tick it.',
      'Each fee row in Edit Job now shows whether the notice was emailed and when; "Email notice…" sends it any time, and re-sends are clearly labeled.',
      'Just billed and skipped the box? The success screen offers "Email the notice now."',
      'Every send lands in the Job activity feed, and fees now link correctly to the bill that carried them.',
    ],
  },
  {
    version: 'v2.1038',
    date: '2026-07-28',
    title: 'Edit, void, or delete a hazmat fee',
    kind: 'feature',
    highlights: [
      'Edit Job → RIDERS rows now have Edit… to change a fee’s amount, description, photos, or testimonials — the Job Total and the open bill move with the amount.',
      'Assistants can Void a fee (removes the charge, keeps the record); devs, masters, and controllers can also Delete it (restorable from Recently deleted).',
      'Every edit, void, and delete lands in the Job activity feed, and the printable notice shows an edited-on date or a VOIDED banner.',
      'Once the fee is on a sent bill, the buttons lock with an explanation.',
    ],
  },
  {
    version: 'v2.1037',
    date: '2026-07-28',
    title: 'Preview the hazmat notice email',
    kind: 'feature',
    highlights: [
      'The hazmat box in Bill Customer now has "Preview the email…" — see exactly what the customer receives: recipient, subject, the message, and the attached notice.',
    ],
  },
  {
    version: 'v2.1036',
    date: '2026-07-28',
    title: 'Cleaner hazmat box; override covers the fee',
    kind: 'fix',
    highlights: [
      'The two red hazmat boxes in Bill Customer merged into one: the fee summary on top, the email-the-notice checkbox beneath.',
      'A Line item override now covers the hazmat fee too — the whole amount ships under your custom wording with no separate fee line.',
    ],
  },
  {
    version: 'v2.1035',
    date: '2026-07-28',
    title: 'Hazmat fee counted once, shown once',
    kind: 'fix',
    highlights: [
      'The bill already includes the hazmat fee (the open bill tracks the job\'s full remainder), so the short-lived "Add hazmat fee" checkbox is gone — it would have charged the fee twice.',
      'Previews and the sent invoice show the fee as its own labeled line inside the bill total, and the incident attaches to the invoice once it ships.',
    ],
  },
  {
    version: 'v2.1034',
    date: '2026-07-28',
    title: 'Previews show the hazmat fee line',
    kind: 'fix',
    highlights: [
      'The Stripe and Physical invoice previews in Bill Customer now show the Biohazard remediation fee as its own line with the grown total — matching exactly what the customer will receive.',
    ],
  },
  {
    version: 'v2.1033',
    date: '2026-07-28',
    title: 'Rider fees show up in Stages totals and Bill Customer',
    kind: 'fix',
    highlights: [
      'The Stages board\'s bid and Left on Job figures now include hazmat fees (existing jobs corrected).',
      'Bill Customer offers a pre-checked "Add hazmat fee" box that grows the invoice total — on both Stripe and Physical — with the fee as its own labeled line.',
      'Once the fee ships on a bill it attaches to that invoice, so it can never be added twice.',
    ],
  },
  {
    version: 'v2.1032',
    date: '2026-07-27',
    title: 'Rider rows read better on desktop',
    kind: 'fix',
    highlights: [
      'The rider line no longer wraps mid-title — the fee sits right-aligned on the same line, and the notice buttons stretch across the full row.',
    ],
  },
  {
    version: 'v2.1031',
    date: '2026-07-27',
    title: 'Hazmat fees: no more instant rider bills',
    kind: 'feature',
    highlights: [
      'Adding a hazmat fee never creates a separate bill anymore — with no open main bill, the fee simply joins the job total and rides on the next bill you send.',
      'When that bill goes out, the fee still appears as its own labeled line item and the incident attaches itself to that invoice.',
      'On Edit Job, such fees show an "In job total" tag until they ship on a bill.',
    ],
  },
  {
    version: 'v2.1030',
    date: '2026-07-27',
    title: 'Rider row icon polish',
    kind: 'fix',
    highlights: [
      'The ☣ on rider lines now sits on the same line as the fee title, sized to match the text.',
    ],
  },
  {
    version: 'v2.1029',
    date: '2026-07-27',
    title: 'Riders join Line Items',
    kind: 'feature',
    highlights: [
      'On Edit Job, hazmat fees now appear as their own rows in ① Line Items — right under the work — instead of down in the invoices area.',
      'The Job Total includes them with a breakdown: "$4,210.00 work + $500.00 riders".',
      'Saving a job no longer silently drops rider fees out of the job\'s revenue.',
    ],
  },
  {
    version: 'v2.1028',
    date: '2026-07-27',
    title: 'Hazmat fees join the main bill',
    kind: 'feature',
    highlights: [
      'Adding a hazmat fee now increases the job\'s billing line directly — $1,380 + $500 fee reads $1,880 — instead of creating a separate rider bill that looked like a deduction.',
      'When the bill goes out, the fee still shows as its own labeled line item, on Stripe and now on Physical Invoice too, with the notice traveling along.',
      'If the job has no open main bill, the fee falls back to its own ready-to-bill line so it\'s never lost.',
    ],
  },
  {
    version: 'v2.1027',
    date: '2026-07-27',
    title: 'Bill jobs that only have a Click number',
    kind: 'fix',
    highlights: [
      'Creating a Stripe invoice no longer requires an HCP number — jobs with only a Click number (C#) bill normally, and the invoice number uses that number.',
    ],
  },
  {
    version: 'v2.1026',
    date: '2026-07-27',
    title: 'Plain-language message when you have no signal',
    kind: 'fix',
    highlights: [
      'If your phone has no service when you save something, the app now says "No connection — check your signal and try again" instead of a technical error like "TypeError: Load failed".',
      'Whatever you typed stays in the box so you can retry when the signal comes back.',
    ],
  },
  {
    version: 'v2.1025',
    date: '2026-07-25',
    title: 'Report types keep your text',
    kind: 'fix',
    highlights: [
      'Switching between report types (Status, Walk, Note, EOD) no longer erases what you\'ve typed — each type keeps its entries until you save or close.',
      'Saving still submits only the fields of the type you\'re on.',
    ],
  },
  {
    version: 'v2.1024',
    date: '2026-07-25',
    title: 'Red phone asks Dispatch for a number',
    kind: 'feature',
    highlights: [
      'Job cards with no customer phone now show a red phone — tap it and Dispatch gets a request to add the number, just like the red photos icon.',
      'Tapping again won\'t double up: if the request is already in, you\'re told it\'s on its way.',
    ],
  },
  {
    version: 'v2.1023',
    date: '2026-07-25',
    title: 'One Call button per job card',
    kind: 'fix',
    highlights: [
      'Ready to Bill cards on the Dashboard showed two phone icons per job — now there is exactly one, next to Collect and Leave Report like the other sections.',
    ],
  },
  {
    version: 'v2.1022',
    date: '2026-07-25',
    title: 'Review deletions goes straight to the deletions',
    kind: 'fix',
    highlights: [
      'The bulk-deletion alert\'s Review deletions button now opens Settings with Recently deleted already expanded, loaded, and scrolled into view.',
      'While the alert is active, that section shows it with the same Snooze / Dismiss buttons — so you can review and clear the notice in one place.',
    ],
  },
  {
    version: 'v2.1021',
    date: '2026-07-25',
    title: 'Nicer discard-report prompt',
    kind: 'fix',
    highlights: [
      'Closing a half-written report now shows a proper in-app "Discard this report?" dialog with Keep writing / Discard report buttons, instead of the plain browser popup.',
    ],
  },
  {
    version: 'v2.1020',
    date: '2026-07-25',
    title: 'Report fields grow as you type',
    kind: 'feature',
    highlights: [
      'Text fields on New report and Additional Report now expand to fit what you write — no more reading a long update through a three-line window.',
    ],
  },
  {
    version: 'v2.1019',
    date: '2026-07-25',
    title: 'Clearer job picker on New report',
    kind: 'feature',
    highlights: [
      'The job section is now one card: "Reporting on" shows the selected job with a Change button, instead of repeating the same job across a pill, a status box, and a search field.',
      'Tap Change to search — your last-report job stays one tap away as a suggestion chip.',
    ],
  },
  {
    version: 'v2.1018',
    date: '2026-07-24',
    title: 'Shorter report type names',
    kind: 'feature',
    highlights: [
      'The New report picker now says Status and Walk instead of Status Report and Walk Report — same wording as the Additional Report window.',
    ],
  },
  {
    version: 'v2.1017',
    date: '2026-07-24',
    title: 'Job report form rebuilt for phones',
    kind: 'feature',
    highlights: [
      'On a phone the New report form now opens full screen with Save pinned at the bottom — no more scrolling to find it or mis-tapping the tab bar.',
      'The form stays usable while the keyboard is open, and closing with something typed asks before discarding your entries.',
      'The Job Complete report type is retired — file a Status Report and set the slider to 100% to get the same Ready-to-Bill prompt.',
    ],
  },
  {
    version: 'v2.1016',
    date: '2026-07-24',
    title: 'One archive dialog',
    kind: 'feature',
    highlights: [
      'Archiving an account is now a single dialog — the separate "Archive User & Reassign Customers" button is gone.',
      'If the account owns customers, the same confirmation asks whether to keep them on the archived account or reassign them to another master in one step.',
      'The top Archive user button now picks the account from a dropdown instead of asking you to type their email.',
    ],
  },
  {
    version: 'v2.1015',
    date: '2026-07-24',
    title: 'External subcontractor merge fix',
    kind: 'fix',
    highlights: [
      'Merging an external subcontractor into an account that had no roster entry failed at the last step — it now links the person to the account directly and completes.',
    ],
  },
  {
    version: 'v2.1014',
    date: '2026-07-24',
    title: 'Merge external subcontractors into accounts',
    kind: 'feature',
    highlights: [
      'In Merge users (Manage accounts), keeping a subcontractor account now also offers external subcontractors — roster entries with no login — in the merge-away list.',
      'Merging one folds their hours, crew records, and sub sheets onto the kept account, creating its roster entry automatically if needed; the external row is archived, never deleted.',
    ],
  },
  {
    version: 'v2.1013',
    date: '2026-07-24',
    title: 'Search in Manage accounts',
    kind: 'feature',
    highlights: [
      'The Manage accounts window (People → Users) now has a search bar at the top — type a name, email, or role to jump straight to the account, including archived ones.',
    ],
  },
  {
    version: 'v2.1012',
    date: '2026-07-24',
    title: 'Labor costs survive renames too',
    kind: 'infra',
    highlights: [
      'Crew P&L and Job Summary labor math now look up wages by person id first, so renaming someone no longer silently drops their labor cost to zero.',
    ],
  },
  {
    version: 'v2.1011',
    date: '2026-07-24',
    title: 'Paid-email wages survive renames',
    kind: 'infra',
    highlights: [
      'The "Customer paid" email\'s labor figures now look wages up by person id instead of typed name, so renaming someone no longer zeroes their hours in the financial review.',
    ],
  },
  {
    version: 'v2.1010',
    date: '2026-07-24',
    title: 'Crew P&L keys on the person, not the spelling',
    kind: 'infra',
    highlights: [
      'Crew P&L now identifies people by their stored id first, so a renamed crew member\'s history stays on one line instead of splitting by spelling.',
    ],
  },
  {
    version: 'v2.1009',
    date: '2026-07-24',
    title: 'Payroll identity: the rest of the tables',
    kind: 'infra',
    highlights: [
      'Crew bids, pay stub days, offsets, and review records are now person-keyed like the rest of payroll, and sub-sheet assignees gained a proper link table — all behind the scenes, nothing you see changes.',
    ],
  },
  {
    version: 'v2.1008',
    date: '2026-07-24',
    title: 'Payroll identity gets rename-proof',
    kind: 'infra',
    highlights: [
      'Behind the scenes, hours, pay config, crew records, and pay stubs are now keyed to the person — not just their typed name — so renaming someone can no longer silently break their payroll history.',
    ],
  },
  {
    version: 'v2.1007',
    date: '2026-07-24',
    title: 'Update reminders come back around',
    kind: 'fix',
    highlights: [
      'If you tap "Not now" on the new-version pill, it now gently reappears as you move between pages (at most every 10 minutes) until you reload — so phones stop riding week-old versions.',
    ],
  },
  {
    version: 'v2.1006',
    date: '2026-07-24',
    title: 'Call the customer from any Dashboard job card',
    kind: 'feature',
    highlights: [
      'The phone button now appears on Ready to Bill, Assigned Jobs, and Superintendent Jobs cards — not just My Schedule — whenever the job has a customer phone.',
      'Same tap-safe flow everywhere: the number opens in a window first, and Log call posts your notes to the job\'s activity thread across the app.',
    ],
  },
  {
    version: 'v2.1005',
    date: '2026-07-24',
    title: 'Billing popups fit phone screens',
    kind: 'fix',
    highlights: [
      'Bill Customer, payment confirmations, bill views, sub-labor forms, and the Stages dialogs no longer hang off the edge of a phone — every panel now fits the screen with desktop sizes unchanged.',
    ],
  },
  {
    version: 'v2.1004',
    date: '2026-07-24',
    title: 'Housekeeping: Dashboard job lists reorganized internally',
    kind: 'infra',
    highlights: [
      'The Assigned Jobs and Superintendent Jobs sections were restructured under the hood so future improvements land on all Dashboard job cards at once. Nothing you see changes.',
    ],
  },
  {
    version: 'v2.1003',
    date: '2026-07-24',
    title: 'Build safety: phones get an automatic layout check',
    kind: 'infra',
    highlights: [
      'A nightly automated check now loads the main pages at phone size and fails if anything pushes the page sideways or a popup\'s close button scrolls out of reach — the bug class we fixed by hand all week.',
      'It caught one immediately: the Materials page no longer pans sideways on phones, and the Parts Book table now scrolls so every column is reachable.',
    ],
  },
  {
    version: 'v2.1002',
    date: '2026-07-24',
    title: 'Hazmat fees roll into the final bill',
    kind: 'feature',
    highlights: [
      'When you Bill Customer and the job has an unsent biohazard fee, a pre-checked box folds it into that invoice as its own labeled line — one bill instead of two, with the notice link still included.',
      'Uncheck the box to keep billing it separately; fees the customer already received are never merged.',
    ],
  },
  {
    version: 'v2.1001',
    date: '2026-07-24',
    title: 'Stripe memo leads with the service address',
    kind: 'feature',
    highlights: [
      'New Stripe invoices start the memo with "Service address: …", so it shows right on the emailed invoice card.',
      'The check-payment wording now reads "Paper checks can be sent to:" and asks customers to call first.',
    ],
  },
  {
    version: 'v2.1000',
    date: '2026-07-24',
    title: 'Build safety: update checks can no longer split',
    kind: 'infra',
    highlights: [
      'The checks that guard pull requests and the checks that guard deploys are now verified to be identical, so a green PR can never again hide a failing deploy (the cause of the v2.986 outage).',
    ],
  },
  {
    version: 'v2.999',
    date: '2026-07-24',
    title: 'Assigned Jobs buttons reordered',
    kind: 'fix',
    highlights: [
      'On Assigned Jobs, Send to Billing now comes first and Leave Report second — the same order as the Ready to Bill cards.',
    ],
  },
  {
    version: 'v2.998',
    date: '2026-07-24',
    title: 'Stripe invoices show the service address',
    kind: 'feature',
    highlights: [
      'New Stripe invoices now carry a "Service address" line in the header — taken from the job\'s address — on both the emailed invoice page and the PDF.',
    ],
  },
  {
    version: 'v2.997',
    date: '2026-07-24',
    title: 'Compact Assigned Jobs cards on your phone',
    kind: 'fix',
    highlights: [
      'Assigned Jobs rows now use the same streamlined phone layout as Ready to Bill — job info full width, icons and the Leave Report + Send to Billing buttons together on one row, and a single "Open 1d · Schedule 22h ago" line.',
    ],
  },
  {
    version: 'v2.996',
    date: '2026-07-24',
    title: 'Schedule rows line up their buttons',
    kind: 'fix',
    highlights: [
      'On My Schedule the phone icon now always sits in line with the photos icon and Leave Report, even when the job name wraps.',
      'Tapping a missing photos link now says: "Note sent to dispatch to add a photos link, if you need it sooner call dispatch!"',
      'The clocked-in Dashboard button now reads "Update Focus this Shift".',
    ],
  },
  {
    version: 'v2.995',
    date: '2026-07-24',
    title: 'Call the customer without mis-taps, and log the call',
    kind: 'feature',
    highlights: [
      'The phone icon on Dashboard schedule rows is now the same size as the photo icon, and tapping it opens a window showing the number — so a stray tap no longer starts a call.',
      'Tap the big number to dial, then jot notes about the call; Log call posts them to the job\'s activity thread everywhere in the app.',
    ],
  },
  {
    version: 'v2.994',
    date: '2026-07-24',
    title: 'Compact Ready to Bill cards on your phone',
    kind: 'fix',
    highlights: [
      'For subcontractors and helpers, each Ready to Bill card is now much shorter and easier to scan on a phone — about four fit where two and a half did before.',
      'The document icons moved up beside the job name, and Collect + Leave Report now sit together on one row.',
      'Job age reads compactly as "Open 2m 3w", and the open time, % complete, and last activity share a single line.',
    ],
  },
  {
    version: 'v2.993',
    date: '2026-07-24',
    title: 'Housekeeping: removed an unused screen',
    kind: 'infra',
    highlights: [
      'A person time-detail popup that nothing in the app opened any more has been removed from the code. Nothing you use changes.',
    ],
  },
  {
    version: 'v2.992',
    date: '2026-07-24',
    title: 'Every report modal closes without scrolling back up',
    kind: 'fix',
    highlights: [
      'New report, Report view, Edit report, Add inspection, Create trip charge and Review hours now keep their title bar and ✕ pinned at the top while you scroll — the same fix Additional Report got in v2.990.',
      'The ✕ is a bigger tap target on all of them, and the panels no longer run off the side of a narrow phone.',
      'The page behind an open modal is now frozen: dragging inside a modal no longer scrolls the list underneath, and closing puts you back exactly where you were.',
    ],
  },
  {
    version: 'v2.991',
    date: '2026-07-24',
    title: 'Set who gets emailed when an estimate is accepted',
    kind: 'feature',
    highlights: [
      'A new ⚙ Accepted notifications button on Estimates lets you pick people who are emailed every time a customer accepts an estimate — including estimates already out with customers.',
      'Individual estimates can still add extra people under "Email when customer accepts"; those are sent as well.',
      'Anyone without an email address, or without access to the estimate\'s owner, is skipped automatically.',
    ],
  },
  {
    version: 'v2.990',
    date: '2026-07-24',
    title: 'Close the Additional Report without scrolling back up',
    kind: 'fix',
    highlights: [
      'The Additional Report title bar and its ✕ now stay pinned at the top while you fill out the form on a phone — no more scrolling all the way back up just to close it.',
      'The ✕ is also a bigger, easier tap target, and the report fits narrow phones properly.',
    ],
  },
  {
    version: 'v2.989',
    date: '2026-07-23',
    title: 'C# jobs sort in order on Stages',
    kind: 'fix',
    highlights: [
      'Jobs with a C# instead of an HCP number no longer pile up at the bottom of each Stages section — they now sit in numeric order alongside HCP jobs, the way the numbers read on screen.',
    ],
  },
  {
    version: 'v2.988',
    date: '2026-07-23',
    title: 'New jobs start in Working',
    kind: 'feature',
    highlights: [
      'Jobs now land in Working the moment they are created — both from New Job and from an accepted estimate — instead of sitting in Waiting until someone clocked out on them.',
      'Waiting is still there as a parking stage you can send a job back to.',
    ],
  },
  {
    version: 'v2.987',
    date: '2026-07-23',
    title: 'Billed Awaiting Payment header reads cleanly on phones',
    kind: 'fix',
    highlights: [
      'On phones the Billed Awaiting Payment heading now stacks into three tidy rows — the title, the 30+/90+ day summary, then the Accounts Receivable and Print buttons — instead of squeezing the title into a jumble.',
    ],
  },
  {
    version: 'v2.986',
    date: '2026-07-23',
    title: 'App updates flowing again',
    kind: 'fix',
    highlights: [
      'A build check had been silently blocking every site update since v2.965 — today\'s phone fixes (Stages tables, header, bottom tab bar) actually reach your device with this release.',
    ],
  },
  {
    version: 'v2.985',
    date: '2026-07-23',
    title: 'Bottom tab bar gets out of the way while typing',
    kind: 'fix',
    highlights: [
      'The Dispatch/Job Mode bottom tabs (Dashboard, Schedule, Inbox, Customers) now slide out of view while the phone keyboard is open, instead of floating mid-screen or sitting on top of the keyboard.',
      'The bar comes right back when the keyboard closes.',
    ],
  },
  {
    version: 'v2.984',
    date: '2026-07-23',
    title: 'Jobs Stages tables readable on phones',
    kind: 'fix',
    highlights: [
      'On phones the Stages tables no longer squeeze the Job column into an unreadable overlap — job names, addresses, and action icons each keep their own space (swipe the table sideways for the other columns).',
      'The expanded Job activity / notes panel now stays fully on-screen even when the table is scrolled sideways.',
    ],
  },
  {
    version: 'v2.983',
    date: '2026-07-23',
    title: 'Combine duplicate people',
    kind: 'feature',
    highlights: [
      'A new Combine button on People → Users folds a duplicate identity (like a name typed with a stage suffix) into the real person — hours, pay, crew records, and sub sheets move with them.',
      'You see exactly how many rows will move before confirming, and the duplicate is archived, never deleted.',
    ],
  },
  {
    version: 'v2.982',
    date: '2026-07-23',
    title: 'Header menu collapses whenever it runs out of room',
    kind: 'fix',
    highlights: [
      'On mid-size screens (small tablets, split-screen, narrow windows) the top navigation no longer spills off the right edge — it now switches to the compact menu the moment it doesn\'t fit, and switches back when there\'s room.',
    ],
  },
  {
    version: 'v2.981',
    date: '2026-07-23',
    title: 'Sub equivalent rate defaults to $50',
    kind: 'fix',
    highlights: [
      'Crew P&L\'s Sub $/hr equivalent rate now defaults to $50 when not set.',
    ],
  },
  {
    version: 'v2.980',
    date: '2026-07-23',
    title: 'Jobs Stages fits phone screens again',
    kind: 'fix',
    highlights: [
      'The Stages toolbar and alert chips now wrap on narrow screens instead of stretching the whole page sideways, so scrolling and zooming on a phone no longer drifts into cut-off tables.',
    ],
  },
  {
    version: 'v2.979',
    date: '2026-07-23',
    title: 'Crew P&L billing works on first load',
    kind: 'fix',
    highlights: [
      'Billing no longer shows empty until you switch tabs, and sub sheets now actually link to their jobs — verified live: 93% of sub labor linked, profits positive.',
    ],
  },
  {
    version: 'v2.978',
    date: '2026-07-23',
    title: 'Crew P&L negative-profit bug fixed',
    kind: 'fix',
    highlights: [
      'The jobs list behind Crew P&L was silently cut off at 1,000 rows, starving most people of revenue credit — it now loads every job.',
    ],
  },
  {
    version: 'v2.977',
    date: '2026-07-23',
    title: 'Crew P&L weighs subs by dollars and audits sheet links',
    kind: 'feature',
    highlights: [
      'Sub revenue shares now always come from what they were paid — sheet unit-hours can no longer shrink a sub\'s credit.',
      'A new audit line shows how much sub money is linked to jobs, lists sheets whose job # matched nothing, and flags affected people with a red "unlinked" badge.',
    ],
  },
  {
    version: 'v2.976',
    date: '2026-07-23',
    title: 'Crew P&L sees every job',
    kind: 'fix',
    highlights: [
      'Crew P&L now loads the complete jobs list — paid jobs no longer show as ID strings with missing billing, and per-job subs get credit on finished work.',
    ],
  },
  {
    version: 'v2.975',
    date: '2026-07-23',
    title: 'Cleaner Stages headers and report names',
    kind: 'fix',
    highlights: [
      'Stages columns now read "Team & Last-update" and "Activity".',
      'Reports show the job number instead of raw ID strings for oddly-named imported jobs.',
    ],
  },
  {
    version: 'v2.974',
    date: '2026-07-23',
    title: 'Crew P&L finally counts sub labor fairly',
    kind: 'feature',
    highlights: [
      'Per-job subs now get their share of job revenue: a $3,000 flat job at the $30/hr equivalent rate weighs the same as 100 clocked hours.',
      'Estimated shares are marked with ≈, and devs can tune the equivalent rate right on the Crew P&L toolbar.',
    ],
  },
  {
    version: 'v2.973',
    date: '2026-07-23',
    title: 'Stages headers show compact totals',
    kind: 'fix',
    highlights: [
      'Section totals on Jobs → Stages read like "$144.8k" instead of "$144,869.25" — truncated, never rounded up. Row amounts stay exact.',
    ],
  },
  {
    version: 'v2.972',
    date: '2026-07-23',
    title: 'Fix missing job info right from Quickfill',
    kind: 'feature',
    highlights: [
      'The Quickfill section now lists every job missing a customer link, pictures link, or billing email — with the job number, name, customer, and address on each row.',
      'Type the missing link or email right in the row and hit Save; rows disappear as you fix them.',
    ],
  },
  {
    version: 'v2.971',
    date: '2026-07-23',
    title: 'Collections columns stop wiggling too',
    kind: 'fix',
    highlights: [
      'The Billed and Collections sections on Jobs → Stages get the same pinned column widths as the other sections — no more shifting while rows load or you search.',
    ],
  },
  {
    version: 'v2.970',
    date: '2026-07-23',
    title: 'Send the paid email from Job Detail',
    kind: 'feature',
    highlights: [
      'A ✉ next to Edit job lets devs and masters send the paid-in-full email for that job to anyone — the recipient\'s role decides whether they get the detailed or summary version.',
      'Preview either version in a new tab or email yourself a test first; manual sends are footnoted "Sent manually by …".',
    ],
  },
  {
    version: 'v2.969',
    date: '2026-07-23',
    title: 'Paid emails show the exact payment',
    kind: 'feature',
    highlights: [
      'Both paid-in-full emails now lead with the exact amount and time of the payment — and the amount is in the subject line.',
      'Assistants and other summary recipients see the paid amount too; all other financials stay in the detailed version.',
    ],
  },
  {
    version: 'v2.968',
    date: '2026-07-23',
    title: 'Paid notifications gear gets a label',
    kind: 'fix',
    highlights: [
      'The gear across from Paid in Full on Jobs → Stages now says "Paid notifications" so it\'s clear what it configures.',
    ],
  },
  {
    version: 'v2.967',
    date: '2026-07-23',
    title: 'Stages tables stop wiggling',
    kind: 'fix',
    highlights: [
      'The job column on Jobs → Stages no longer shifts a few pixels when sections load or you search — column widths are pinned.',
    ],
  },
  {
    version: 'v2.966',
    date: '2026-07-23',
    title: 'Job number columns say "Job #"',
    kind: 'fix',
    highlights: [
      'The "HCP" column headers across the Jobs tabs now read "Job #" — the number shown can be an HCP number or a C#.',
    ],
  },
  {
    version: 'v2.965',
    date: '2026-07-22',
    title: 'Get an email when a job is paid in full',
    kind: 'feature',
    highlights: [
      'When a job reaches Paid in Full, chosen people get an email automatically — devs and masters see the full financial review (labor, parts, payments, profit), everyone else gets a summary with no dollar amounts.',
      'A gear next to the Paid in Full section on Jobs → Stages picks the recipients (devs edit; masters can view).',
      'From the same gear, preview either email for any job or send yourself a test copy.',
    ],
  },
  {
    version: 'v2.964',
    date: '2026-07-23',
    title: 'Dispatch Mode loses the redundant More tab',
    kind: 'fix',
    highlights: [
      'The bottom bar drops "More" — the regular navigation at the top already takes you everywhere else.',
    ],
  },
  {
    version: 'v2.963',
    date: '2026-07-22',
    title: 'C# fallback reaches the last few screens',
    kind: 'fix',
    highlights: [
      'Jobs without an HCP number now show their C# on the Dashboard billing pipeline, Jobs Stages/Billing/Parts, printed billing reports, and the Materials PO Generator — instead of "—".',
      'Confirmation and report pop-ups opened from those screens carry the same number.',
    ],
  },
  {
    version: 'v2.962',
    date: '2026-07-22',
    title: 'Jobs without an HCP number show their C#',
    kind: 'fix',
    highlights: [
      'Anywhere a job used to show "—" because it had no HCP number, it now falls back to its C# — My Time, Projects history, Documents, Banking, Dispatch PO, and more.',
    ],
  },
  {
    version: 'v2.961',
    date: '2026-07-22',
    title: 'Candidate links stay short and clickable',
    kind: 'fix',
    highlights: [
      'Long URLs pasted into a candidate\'s source or notes no longer spill off the screen — they show as short clickable links like "🔗 indeed.com".',
    ],
  },
  {
    version: 'v2.960',
    date: '2026-07-22',
    title: 'Reminders keep team reviews on schedule',
    kind: 'feature',
    highlights: [
      'A "Team reviews due" notice appears on your Dashboard and Dispatch Inbox when teammates haven\'t had your review in 30+ days — tap it to land right on the Rate deck.',
      'Devs can change the 30-day cadence in Settings → Dashboard & alerts.',
    ],
  },
  {
    version: 'v2.959',
    date: '2026-07-22',
    title: 'PO screen titled "PO Generator"',
    kind: 'fix',
    highlights: ['The phone PO screen\'s title now matches the desktop PO Generator it shares numbering with.'],
  },
  {
    version: 'v2.958',
    date: '2026-07-22',
    title: 'The PO screen feels instant',
    kind: 'fix',
    highlights: [
      'Sorting into Other happens the moment your swipe lands — no waiting on the network (and it undoes itself with a message if the save fails).',
      'Sheets slide, dialogs pop, and chips respond to your touch; phones that support it get a small haptic tick.',
    ],
  },
  {
    version: 'v2.957',
    date: '2026-07-22',
    title: 'Clearer picks on the phone PO screen',
    kind: 'fix',
    highlights: [
      'Picking someone from Other now shows just their name — deselect to see the full list again.',
      'Selected choices get a bold orange ring.',
      'A hint under the title explains hold-to-sort.',
    ],
  },
  {
    version: 'v2.956',
    date: '2026-07-22',
    title: 'PO job step says where its list comes from',
    kind: 'fix',
    highlights: [
      'The phone PO screen\'s first step now reads "Job (On schedule today)" — the quick picks are today\'s scheduled jobs; anything else is a search away.',
    ],
  },
  {
    version: 'v2.955',
    date: '2026-07-22',
    title: 'Tidy the PO pickers with an Other bucket',
    kind: 'feature',
    highlights: [
      'On the phone PO screen, hold any person or supply house and slide to confirm — it tucks under an "Other" entry at the end of the list, for everyone.',
      'Tap Other to pick from the tucked-away options, or hold one and slide to bring it back.',
      'People working the picked job today always stay in the main list.',
    ],
  },
  {
    version: 'v2.954',
    date: '2026-07-22',
    title: 'Team leaderboard',
    kind: 'feature',
    highlights: [
      'New Leaderboard view on Team → Review: every role ranked by the skew-corrected composite, with each role’s average and weakest link.',
      'A replace-priority strip surfaces the lowest scores company-wide, one click from the hiring board.',
      'Devs can tune how much Ability, Drive, and Integrity each count.',
    ],
  },
  {
    version: 'v2.953',
    date: '2026-07-22',
    title: 'One score per person',
    kind: 'feature',
    highlights: [
      'Each Reflect card now shows a composite score: the three skew-corrected ratings blended together, with recent months counting more than old ones.',
      'People with fewer than two reviewers show "insufficient data" instead of a misleading number.',
      'The ratings chart gains a dashed composite trend line.',
    ],
  },
  {
    version: 'v2.952',
    date: '2026-07-22',
    title: 'Team reviews correct for tough and easy graders',
    kind: 'feature',
    highlights: [
      'Reflect shows each reviewer’s own average, so a 60 from a tough grader reads differently than a 60 from an easy one.',
      'Every score is anchored to its reviewer’s norm ("+6 vs their norm"), and each person gets an adjusted average that corrects for grader skew.',
      'While rating, you see your own running average to keep yourself calibrated.',
    ],
  },
  {
    version: 'v2.951',
    date: '2026-07-22',
    title: 'Reflect shows tenure and rating trends',
    kind: 'feature',
    highlights: [
      'Each person’s Reflect card now shows how long they’ve been at the company.',
      'Click a person to expand a chart of their Ability, Drive, and Integrity ratings over time.',
    ],
  },
  {
    version: 'v2.950',
    date: '2026-07-22',
    title: 'Team reviews flow card to card',
    kind: 'feature',
    highlights: [
      'Saving a team review now jumps straight to the next person you haven’t rated this month.',
      'When everyone’s done, the button turns green — "All rated! Go to Reflect" — and takes you to the team overview.',
    ],
  },
  {
    version: 'v2.949',
    date: '2026-07-22',
    title: 'Review comment boxes look like fields',
    kind: 'fix',
    highlights: [
      'The "why this score?" comment boxes under the Ability, Drive, and Integrity sliders now clearly read as places you can type.',
    ],
  },
  {
    version: 'v2.948',
    date: '2026-07-22',
    title: 'Rate your current team, monthly',
    kind: 'feature',
    highlights: [
      'New Review stage on the Team board: flip through a card for each team member — name, role, their last 5 jobs — and score Ability, Drive, and Integrity with a note per rating.',
      'One review per person per month builds a track record over time.',
      'The Reflect view shows everyone’s latest reviews side by side with a team average per person.',
    ],
  },
  {
    version: 'v2.947',
    date: '2026-07-22',
    title: 'Internal: database type definitions refreshed',
    kind: 'infra',
    highlights: [
      'Developer-facing only — the app’s database type definitions were re-synced with the live schema. No visible changes.',
    ],
  },
  {
    version: 'v2.946',
    date: '2026-07-22',
    title: 'Comment on each interview rating',
    kind: 'feature',
    highlights: [
      'My review on the hiring boards now takes an optional note under each rating — Ability, Drive, and Integrity each get their own "why this score" comment.',
      'Comments show under your numbers on the candidate card, alongside your overall remarks.',
    ],
  },
  {
    version: 'v2.945',
    date: '2026-07-22',
    title: 'Prospects card actions look like buttons',
    kind: 'fix',
    highlights: [
      'Talked today, Passed, and the other candidate-card actions on the hiring boards now render as raised buttons instead of flat labels.',
    ],
  },
  {
    version: 'v2.944',
    date: '2026-07-22',
    title: 'Release notes arrive in Settings',
    kind: 'feature',
    highlights: [
      'New Release notes tab in Settings for every role — what changed in each update, newest first.',
      'Every future update ships with its own note automatically.',
    ],
  },
  {
    version: 'v2.943',
    date: '2026-07-22',
    title: 'Company documents editing moves behind a gear',
    kind: 'feature',
    highlights: [
      'The company documents list is read-only everywhere; devs manage it from a ⚙ gear on Documents → Company.',
      'Settings keeps a view-only list with a pointer to the new manage spot.',
    ],
  },
  {
    version: 'v2.942',
    date: '2026-07-22',
    title: 'Company documents get their own Documents tab',
    kind: 'feature',
    highlights: [
      'The company documents list now also appears as a Company tab on the Documents page.',
    ],
  },
  {
    version: 'v2.941',
    date: '2026-07-22',
    title: 'Company documents in Settings',
    kind: 'feature',
    highlights: [
      'New Company documents block on Settings → Your account: 📄 buttons that open the current copy of shared documents (I-9, Certificate of Insurance, …).',
      'Each link shows when it was last updated; devs keep the list current.',
    ],
  },
  {
    version: 'v2.940',
    date: '2026-07-22',
    title: 'Named customer contacts and multi-recipient invoice emails',
    kind: 'feature',
    highlights: [
      'Customers can now have named contact persons.',
      'Physical invoice emails can go to additional recipients in one send.',
    ],
  },
  {
    version: 'v2.939',
    date: '2026-07-22',
    title: 'Supply house Add-Invoice job picker fixed',
    kind: 'fix',
    highlights: ['The job picker no longer opens hidden behind the Add Invoice modal.'],
  },
  {
    version: 'v2.938',
    date: '2026-07-22',
    title: 'PO tab in Dispatch Mode',
    kind: 'feature',
    highlights: [
      'Mint a purchase order from your phone in about three taps — new PO tab in Dispatch Mode (gear-menu gated).',
    ],
  },
  {
    version: 'v2.937',
    date: '2026-07-22',
    title: 'Multiple links per hiring candidate',
    kind: 'feature',
    highlights: [
      'Team Prospects candidates can carry several typed links (resume, application, …).',
      'The card Edit action is now a ⚙ gear.',
    ],
  },
  {
    version: 'v2.936',
    date: '2026-07-22',
    title: 'Guardrails for missing customer emails in billing',
    kind: 'feature',
    highlights: [
      'Stages shows a "No email" chip, Bill Customer offers an inline email input, and Ready-to-Bill warns — so a missing email never blocks a bill silently.',
    ],
  },
  {
    version: 'v2.935',
    date: '2026-07-22',
    title: 'Prospects stage tabs centered',
    kind: 'fix',
    highlights: ['The Screen → Interview → Hire tabs are centered on the Team Prospects board.'],
  },
  {
    version: 'v2.934',
    date: '2026-07-22',
    title: '"Show similar" duplicate finder for customers',
    kind: 'feature',
    highlights: [
      'Customers gains a Show similar view that groups likely duplicate records so they can be reviewed and merged.',
    ],
  },
  {
    version: 'v2.933',
    date: '2026-07-22',
    title: 'Edit Job saves work again',
    kind: 'fix',
    highlights: [
      'Fixed a bug where saving Edit Job with changed fields failed with a database error.',
    ],
  },
  {
    version: 'v2.932',
    date: '2026-07-22',
    title: 'Dispatch Day view fills in missing map pins itself',
    kind: 'fix',
    highlights: [
      'Scheduled addresses without coordinates are geocoded automatically, so travel hints stop going missing.',
    ],
  },
  {
    version: 'v2.931',
    date: '2026-07-22',
    title: 'Hiring onboarding tracker',
    kind: 'feature',
    highlights: [
      'The Team Prospects Hire tab becomes an onboarding tracker with a checklist per new hire.',
    ],
  },
  {
    version: 'v2.930',
    date: '2026-07-22',
    title: 'Hiring pipeline stages become sub-tabs',
    kind: 'feature',
    highlights: ['Team Prospects is organized into Screen → Interview → Hire sub-tabs.'],
  },
]
