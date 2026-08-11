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
    version: 'v2.1578',
    date: '2026-08-11',
    title: 'Pipeline mobile cards get a cleaner, shorter layout',
    kind: 'feature',
    highlights: [
      'Each card now reads in clear zones: the job name line, the customer and address together on one line, a tinted money strip (progress, billed, paid, left, and the invoice email status), and the latest activity in one line.',
      'The row of small icons is gone — the card foot keeps the phone icon and the ⋯ menu, which now also lists Assign work, Send to Dispatch, and Send as task, with the crew named at the top.',
      'Cards are roughly a third shorter, so more jobs fit on a phone screen.',
    ],
  },
  {
    version: 'v2.1577',
    date: '2026-08-11',
    title: 'Reliability: labor costing pairs hours to people by identity',
    kind: 'infra',
    highlights: [
      'Hourly workers’ recorded hours now match to their crew assignments by identity rather than spelled name in Job Summary, Crew P&L, and Team Labor — completing the identity series for all labor cost math.',
    ],
  },
  {
    version: 'v2.1576',
    date: '2026-08-11',
    title: 'Pipeline cards: job number moves up beside the job name',
    kind: 'fix',
    highlights: [
      'In Jobs → Pipeline with Mobile cards on, the job-number chip (like "941 PLUM") now sits on the same line as the job name instead of on its own row — every card gets a little shorter.',
    ],
  },
  {
    version: 'v2.1575',
    date: '2026-08-11',
    title: 'Billing accuracy: double-recorded Stripe payments fixed and prevented',
    kind: 'fix',
    highlights: [
      'Two jobs briefly showed a Stripe payment twice (a rare timing issue when Stripe reports the same payment two ways at once) — both are corrected, and the database now prevents the double-record from happening again.',
      'Paid-to-date totals are now locked to the payment records themselves — nothing else can change them.',
    ],
  },
  {
    version: 'v2.1574',
    date: '2026-08-11',
    title: 'Reports view cleans up on phones',
    kind: 'fix',
    highlights: [
      "The full-screen Reports view no longer slides its title under the iPhone status bar — the header now clears the clock and notch.",
      'Old reports imported from HouseCall Pro no longer open with a long technical ID — the note now leads with the job description.',
    ],
  },
  {
    version: 'v2.1573',
    date: '2026-08-11',
    title: 'Unassigned field time explains itself',
    kind: 'feature',
    highlights: [
      'A day assigned only to the Office job now says "Office only — doesn\'t cover field time" instead of the confusing "No crew assignments" — Office time is overhead, so the day stays listed until a field job is assigned.',
      'The day audit marks Office assignments as overhead and explains why they don\'t clear the day.',
      'New "Re-sync from clock" button in the day audit rebuilds a day\'s assignments from its approved clock sessions — the one-click fix when an assignment no longer matches where someone actually clocked.',
    ],
  },
  {
    version: 'v2.1572',
    date: '2026-08-11',
    title: 'The % done fallback reaches more of the Dashboard',
    kind: 'feature',
    highlights: [
      'The Dashboard\'s Ready to Bill cards and the Not Billed Out, Accounts Receivable, and Collections lists now show "0% done" for jobs that never had a progress percent set, matching My Schedule.',
      'The Jobs Pipeline board is unchanged on purpose: a blank progress box there still flags a job the office hasn\'t assessed yet.',
    ],
  },
  {
    version: 'v2.1571',
    date: '2026-08-11',
    title: 'Every My Schedule card shows its % done',
    kind: 'feature',
    highlights: [
      'Jobs that never had a progress percent set no longer show a blank corner on My Schedule — they read 0% done, or 100% done once the job is Paid in Full.',
      'Jobs with a recorded percent are unchanged, and the "today\'s movement" line still appears only for real recorded progress.',
    ],
  },
  {
    version: 'v2.1570',
    date: '2026-08-11',
    title: 'Ready to Bill cards straighten up',
    kind: 'feature',
    highlights: [
      'The Dashboard\'s Ready to Bill cards now follow the same tidy shape as My Schedule at every screen size: job and icons up top, address, one info line ("Open 1 month · 60% done · Schedule 23h ago"), and the buttons on their own row.',
      'No more floating "Last activity" column or stray "Open" label wrapping differently on every card — and each job\'s % done now shows right on the card.',
    ],
  },
  {
    version: 'v2.1569',
    date: '2026-08-11',
    title: 'Dev imitation stops bouncing to production',
    kind: 'fix',
    highlights: [
      'Dev-only: "imitate user" from a local dev server on any port now signs in right there instead of redirecting to pipetooling.com.',
    ],
  },
  {
    version: 'v2.1568',
    date: '2026-08-11',
    title: 'Put jobs on your own schedule',
    kind: 'feature',
    highlights: [
      'My Schedule has a + Add job button: search any active job — Waiting through Billed — pick a day and time, and it\'s on your schedule (and you\'re on the job\'s crew).',
      'The new My day editor rearranges your whole day, including visits dispatch set for you — moving one of those posts a note on the job and shows the office a "moved by tech" tag, so nothing moves silently. Visits you added yourself can also be removed.',
      'Can\'t find the job? Request it: enter the job, customer, and line items — it\'s created in Waiting, lands on your schedule and everyone\'s Schedule page, and Dispatch gets a review request.',
    ],
  },
  {
    version: 'v2.1567',
    date: '2026-08-11',
    title: 'My Schedule shows how far along each job is',
    kind: 'feature',
    highlights: [
      'Every job card on My Schedule now shows the job\'s % done in the corner under the Leave Report button, with how much it moved today underneath — green when it climbed, amber if it was corrected down.',
      'On days a job actually moved, a slim progress bar appears across the card\'s foot with today\'s gain shown in green.',
    ],
  },
  {
    version: 'v2.1566',
    date: '2026-08-11',
    title: 'Recently deleted tells you what died — and why it might matter',
    kind: 'feature',
    highlights: [
      'Each deletion now describes itself in plain words — a clock session shows whose it was, the hours, the note, and whether it was approved; invoices show the amount and status — instead of hiding everything behind raw data.',
      'New warning chips flag what deserves a second look: money removed, records deleted minutes after being created (or months old), approved time deleted, and deletions of someone else\'s records.',
      'Deletions from an active alert group under a burst header — who, when, how many — so you review one burst at a time.',
    ],
  },
  {
    version: 'v2.1565',
    date: '2026-08-11',
    title: 'Bulk-deletion notice adds up at a glance',
    kind: 'feature',
    highlights: [
      'The red deletion notice now lists each burst on its own line — who, how many records, and when — with the combined totals up in the title, so the numbers finally reconcile at a glance.',
      'It says "records" instead of "things", shows times in company time with how long ago, and the raw row count moved to a hover tooltip.',
    ],
  },
  {
    version: 'v2.1564',
    date: '2026-08-11',
    title: 'Review reminders take you to the right person',
    kind: 'feature',
    highlights: [
      'Tapping the "Team reviews due" reminder now opens the Rate deck directly on the person it named — no more paging through the whole team to find them.',
      'People due for your review are marked in the deck\'s dropdown with an amber "N due" count beside it, and saving a review jumps to the next due person until the list is clear.',
    ],
  },
  {
    version: 'v2.1563',
    date: '2026-08-11',
    title: 'Calendar readable on your phone again',
    kind: 'fix',
    highlights: [
      'Month-view chips (jobs, recorded time, planned blocks) were getting sliced off at both ends on narrow screens — they now shorten with … like they should, so "Job 473 · Mike Holub" reads as "473 · Mike Hol…" instead of "ob AM – 4:26".',
    ],
  },
  {
    version: 'v2.1562',
    date: '2026-08-11',
    title: 'Money cards show how old the money is',
    kind: 'feature',
    highlights: [
      'The Accounts Receivable, Accounts Payable, and Not Billed Out cards now carry a thin green/yellow/red aging bar and lead with the amount at risk — like "$78.9k over 30 days" — instead of burying the oldest date in fine print.',
      'The bar uses the same bands as the drill-down\'s aging strip, and the card sublines are now easy round numbers (the "$20,169+11,957" style is gone).',
    ],
  },
  {
    version: 'v2.1561',
    date: '2026-08-10',
    title: 'Staff purchases banner matches the new wording',
    kind: 'feature',
    highlights: [
      'The blue staff banner now reads "Team purchases waiting to be sorted" — N people have M purchases with no job yet, tap to sort them on their behalf.',
      'The window it opens is now called "Team purchases follow-up".',
    ],
  },
  {
    version: 'v2.1560',
    date: '2026-08-10',
    title: 'Clearer wording on the purchases banner',
    kind: 'feature',
    highlights: [
      'The orange dashboard banner now says what it means: "Purchases waiting to be sorted" — N purchases over 2 days old aren\'t on a job yet, tap to sort them in Job Parts Tally.',
    ],
  },
  {
    version: 'v2.1559',
    date: '2026-08-10',
    title: 'Roadmap tab tucked away for now',
    kind: 'feature',
    highlights: [
      'The Checklist page\'s Roadmap tab is temporarily visible to devs only while it\'s being worked on. Old links to it now land on your usual Checklist tab.',
    ],
  },
  {
    version: 'v2.1558',
    date: '2026-08-10',
    title: 'Job activity filters show their counts',
    kind: 'feature',
    highlights: [
      'In the Job activity / notes panel, the Notes, Reports, Status, Billing, and Crew buttons now show how many entries each one holds, so you can see where the action is before tapping.',
      'Categories with nothing in them fade out and aren\'t tappable — no more filtering into an empty list.',
    ],
  },
  {
    version: 'v2.1557',
    date: '2026-08-10',
    title: 'Dispatch call button matches the header',
    kind: 'feature',
    highlights: [
      'The round call-dispatch button next to My Schedule is now the same sky blue as the dispatch button in the header, so the two dispatch actions read as one family.',
    ],
  },
  {
    version: 'v2.1556',
    date: '2026-08-10',
    title: 'Time off history + schedule times on one line',
    kind: 'feature',
    highlights: [
      'In Personal Time Off, past entries are now history: they can\'t be removed and live in a collapsed "Past time off" section at the bottom. Only current and upcoming time off shows Remove.',
      'On My Schedule cards, the time window (8:00 AM–12:00 PM) stays on one line instead of wrapping the PM onto its own row.',
      'The report form\'s title now shows just the job (no "New report ·" prefix), and the type label reads "Report type:".',
    ],
  },
  {
    version: 'v2.1555',
    date: '2026-08-10',
    title: 'Pipeline board slims down',
    kind: 'feature',
    highlights: [
      'The Activity column is gone — the Job column gets all that room. Clicking anywhere on a row still opens the job\'s activity and notes.',
      'The note count now sits right next to the job name, and the Open Invoice chips, Reports button, and Stripe Resend line moved under the job\'s address.',
      'The blue "Job: 961" badge and the separate trade pill merged into one chip — "961 PLUM" — in the trade\'s color.',
    ],
  },
  {
    version: 'v2.1554',
    date: '2026-08-10',
    title: 'Report form: tap the percent, cleaner header',
    kind: 'feature',
    highlights: [
      'The completion percent now has five big tap targets — 0, 25, 50, 75, 100 — with the slider kept underneath for in-between values. Works in every report form.',
      'The report window\'s header shrinks to two lines ("New report · 473 Mike Holub" plus the address, zip dropped), the answer boxes suggest what to write, and Save moved away from Cancel so a hurried thumb can\'t miss.',
    ],
  },
  {
    version: 'v2.1553',
    date: '2026-08-10',
    title: 'My Schedule header cleaned up',
    kind: 'feature',
    highlights: [
      'The "(schedule wrong? click to call dispatch)" fine print next to the My Schedule title is now a round phone button — same one-tap call to dispatch, but it looks like a button.',
      'Day headers shorten to "Today · Mon, Aug 10" style instead of spelling out the full date.',
    ],
  },
  {
    version: 'v2.1552',
    date: '2026-08-10',
    title: 'Clocked-in list: names move to the left edge',
    kind: 'feature',
    highlights: [
      'In the orange Clocked in today list, the little arrow next to each person is gone — names now start at the left edge with more room.',
      'Session rows just show whenever a person has them, and the arrow on the orange header still collapses the whole section.',
    ],
  },
  {
    version: 'v2.1551',
    date: '2026-08-10',
    title: 'My Time gets one tidy card',
    kind: 'feature',
    highlights: [
      'The bottom of the Dashboard is now a single My Time card: Today and This week as easy-to-read durations (7h 23m instead of a ticking 07:23:51), with your week always visible below.',
      'Last week and Personal Time Off sit together in one row at the card\'s foot; the per-job detail stays one tap away.',
      'The orange clocked-in strip above is unchanged.',
    ],
  },
  {
    version: 'v2.1550',
    date: '2026-08-10',
    title: 'One-tap search on Assigned Jobs',
    kind: 'feature',
    highlights: [
      'The Assigned Jobs card on the Dashboard now has a search button in its header — one tap opens the section, puts the search box at the top of your screen, and you can start typing immediately.',
      'It works whether the section was open or closed, and the button is sized for thumbs.',
    ],
  },
  {
    version: 'v2.1549',
    date: '2026-08-10',
    title: 'Report due — the button says it now',
    kind: 'feature',
    highlights: [
      'When your scheduled work ended without a report, the Leave Report button turns amber and reads "Report due" — no more yellow icon covering the label. It goes back to blue once you file.',
      'The job\'s schedule card also gets a thin amber edge so the day list shows at a glance which job still needs its report, and the separate reminder banner under the list is gone.',
    ],
  },
  {
    version: 'v2.1548',
    date: '2026-08-10',
    title: 'Reports read as a timeline + cleaner schedule cards',
    kind: 'feature',
    highlights: [
      'The job Reports screen is now a timeline: newest report shown in full, older ones as one-line previews with Show full report, each with who, type, when, and the completion percent at that moment.',
      'The header sums up the whole job at a glance — "3 reports · 0% → 60% complete" — and the old four-button toolbar collapsed to a single ✕.',
      'My Schedule cards lead with the job name; the job number and address (no zip) get their own full-width line above the dispatch note.',
    ],
  },
  {
    version: 'v2.1547',
    date: '2026-08-10',
    title: 'Report counts on every Leave Report button',
    kind: 'feature',
    highlights: [
      'Every Leave Report button on the Dashboard now wears a small count badge in its bottom-right corner when the job already has reports you can see.',
      'Tapping the badge jumps straight to reading those reports; tapping the button still files a new one. No badge means no reports yet.',
    ],
  },
  {
    version: 'v2.1546',
    date: '2026-08-10',
    title: 'See your whole crew\'s reports on a job',
    kind: 'feature',
    highlights: [
      'Field crew assigned to a job can now see all its reports from fellow field crew — not just their own. Office and superintendent reports stay out of the field view.',
      'The Additional Report window\'s report button moved up next to the files and photos icons as "Reports for this Job", and it opens everyone\'s reports.',
    ],
  },
  {
    version: 'v2.1545',
    date: '2026-08-10',
    title: 'My Schedule: dispatch notes get the full card',
    kind: 'feature',
    highlights: [
      'On the Dashboard\'s My Schedule cards, the dispatch note now runs the full width of the card under the job and time — instead of wrapping in a narrow column beside the buttons.',
      'Long instructions take two lines instead of five, so each day\'s list is shorter and easier to read on a phone.',
    ],
  },
  {
    version: 'v2.1544',
    date: '2026-08-10',
    title: 'Personal Time Off moves to My Time',
    kind: 'feature',
    highlights: [
      'Personal Time Off now lives where you check your hours: a single "Personal Time Off…" button at the bottom of the Dashboard\'s My Time section opens it in a window — same entries list, "Not coming in today" shortcut, and add form as before.',
      'The purple time-off chips on the Calendar open the same window in place instead of jumping to Settings.',
      'The old section under Settings → Your account is gone; old bookmarks still land on the account tab.',
    ],
  },
  {
    version: 'v2.1543',
    date: '2026-08-10',
    title: 'Job notes panel: Schedule uses Assign work',
    kind: 'feature',
    highlights: [
      'The green Schedule button in a Pipeline row\'s expanded activity/notes panel now opens the same Assign work sheet as the row\'s calendar shortcut — day, people (whole crews in one tap), and time, with the job already picked.',
      'It also works on jobs with no team members yet — the sheet offers everyone, so the button is never greyed out.',
    ],
  },
  {
    version: 'v2.1542',
    date: '2026-08-10',
    title: 'Tally on your phone: sort purchases like cards',
    kind: 'feature',
    highlights: [
      'The Transactions tab is now a card list on field phones — store, amount, and day, with a big Sort to job button. No more sideways scrolling.',
      'Sort N purchases walks your unsorted purchases one at a time: your jobs from that day (clocked or scheduled, day before through day after) appear as big buttons — tap the job, confirm, next.',
      'Tap a second job to split: starts even, type an exact amount and the other line balances itself. Undo right after any save.',
      'Another job… still opens the full assign window, and + memo lets you jot what the purchase was for.',
    ],
  },
  {
    version: 'v2.1541',
    date: '2026-08-10',
    title: 'Helper dashboard: clock activity moves next to My Time',
    kind: 'feature',
    highlights: [
      'For Helpers, the "Clocked in today / Jobs worked today" section now sits at the bottom of the Dashboard, just above My Time — your schedule and jobs stay up top.',
      'Everyone else\'s dashboard keeps the section where it was.',
    ],
  },
  {
    version: 'v2.1540',
    date: '2026-08-10',
    title: 'Pipeline: week-dispatch shortcut hides when unusable',
    kind: 'feature',
    highlights: [
      'The blue week-dispatch shortcut on Pipeline rows only appears when the job has team members — before, jobs without a team showed it grayed out with a tooltip.',
      'The green Assign work shortcut stays on every row either way, since it can schedule anyone.',
    ],
  },
  {
    version: 'v2.1539',
    date: '2026-08-10',
    title: 'Timeline guide lines + report reminder moves down',
    kind: 'feature',
    highlights: [
      'Assign work: every availability ribbon (and the Manage day timeline) now shows faint vertical guide lines at 8 AM, 12 PM, and 4 PM, with a small 8a · 12p · 4p label row under the people list — so "free after lunch" is readable at a glance.',
      'Dashboard: the "You haven\'t filed a report yet. File one" reminder on My Schedule now sits below the day\'s job list instead of above it.',
    ],
  },
  {
    version: 'v2.1538',
    date: '2026-08-10',
    title: 'Pipeline: "Send back" is now "Mark Waiting" on Working jobs',
    kind: 'feature',
    highlights: [
      'On Jobs → Pipeline, the button that moves a Working job back to Waiting now says exactly that — Mark Waiting instead of the generic Send back.',
      'Send back keeps its name in the later sections (Ready to Bill, Billed, Collections), where it still means one step backward.',
    ],
  },
  {
    version: 'v2.1537',
    date: '2026-08-10',
    title: 'Assign work: tap a name to manage their day',
    kind: 'feature',
    highlights: [
      'In the Assign work sheet, tap a person’s name (or long-press their row) to open Manage day — their full schedule for that date, right on top of the sheet.',
      'Edit any block’s times, note, or day, or remove it. Linked crew blocks ask whether the change applies to the whole crew or just that person.',
      '‹ › arrows step across days, and a timeline strip shows their day at a glance. Changes update the availability ribbons the moment you’re back.',
      'A "+ Select for this assignment" button adds them to the crew you’re building. Tapping anywhere else on the row still selects, exactly as before.',
    ],
  },
  {
    version: 'v2.1536',
    date: '2026-08-10',
    title: 'Pipeline: schedule with the Assign work sheet',
    kind: 'feature',
    highlights: [
      'The green calendar shortcut on Pipeline rows now opens the same Assign work sheet Dispatch mode uses — with the job already picked, so you land straight on choosing the day, people, and time.',
      'Pick whole crews in one tap, see who is already busy, and use the suggested free windows — exactly like scheduling from Dispatch.',
      'When you confirm, the row’s green Next line updates right where you are — no page reload, your scroll and search stay put.',
      'Jobs without team members can now be scheduled too — the sheet offers everyone, so the shortcut is never greyed out.',
    ],
  },
  {
    version: 'v2.1535',
    date: '2026-08-10',
    title: 'Pipeline: Activity is now a mini-feed',
    kind: 'feature',
    highlights: [
      'Each Pipeline row now shows its latest note AND latest field report as separate one-line entries — tagged Note or Report, newest first, with the age on the right.',
      'The green Next line joins the feed in the same style: who, then the date and time window, on one line. It still opens the job calendar.',
      'Hover any line for the full text; clicking still expands the whole notes thread like before.',
    ],
  },
  {
    version: 'v2.1534',
    date: '2026-08-10',
    title: 'Pipeline: Activity column uses the whole screen',
    kind: 'feature',
    highlights: [
      'On Jobs → Pipeline, the Activity column is no longer a fixed narrow strip — it now grows with your window, splitting the extra width evenly with the Job column.',
      'Notes and report previews get roughly double the room on a typical monitor, and even more on wide screens.',
    ],
  },
  {
    version: 'v2.1533',
    date: '2026-08-10',
    title: 'Option to hide the old HCP field',
    kind: 'feature',
    highlights: [
      'A new dev setting (Settings → Jobs & dispatch) hides the HCP number box on New/Edit Job — HCP numbers are no longer issued, so the empty field just took up space.',
      'Jobs that already have an HCP number keep showing it and it stays editable and searchable. Nothing is deleted.',
    ],
  },
  {
    version: 'v2.1532',
    date: '2026-08-10',
    title: 'Pick a default owner for all new jobs',
    kind: 'feature',
    highlights: [
      'In Settings → Jobs & dispatch → Job creation overrides, devs can now set a default job owner for everyone: any user without their own override — including people added later — creates jobs under that master instead of themselves.',
      'Individual overrides still win, and a new "Self — always" choice exempts a specific person from the default.',
    ],
  },
  {
    version: 'v2.1531',
    date: '2026-08-10',
    title: 'Bill Customer leads with Stripe',
    kind: 'feature',
    highlights: [
      'The Bill Customer window now shows two main choices — Stripe bill and Physical invoice. HouseCall Pro is still there, behind a small ▾ at the end of the row, so it takes a deliberate extra click.',
      'Bill Customer always opens on the Stripe tab now, including jobs with no customer email yet (the banner at the top lets you add the email right there).',
    ],
  },
  {
    version: 'v2.1530',
    date: '2026-08-10',
    title: 'Pipeline shortcut icons moved to the start of each row',
    kind: 'feature',
    highlights: [
      'The little column of shortcut icons on each Pipeline row (schedule, week dispatch, call, send to Dispatch, send as task) now sits at the far left of the row, next to Crew & Dates, instead of beside Activity.',
    ],
  },
  {
    version: 'v2.1529',
    date: '2026-08-10',
    title: 'Job Detail gets a cleaner top with a photo header',
    kind: 'feature',
    highlights: [
      'The job name now leads the Job Detail window (with the job number as a small chip), and all the header buttons sit in one row.',
      'Street View shows as a slim photo banner with the address pinned right on it — tap the address for directions, tap the photo for the full Street View. Phone and email are now tappable chips.',
      'New purple send button in the header: send the job to someone as a task without leaving Job Detail — they get an inbox item whose job link opens this same window.',
    ],
  },
  {
    version: 'v2.1528',
    date: '2026-08-10',
    title: 'New jobs show themselves on the Pipeline',
    kind: 'feature',
    highlights: [
      'After you create a job with New Job on Jobs → Pipeline, the board clears whatever you had typed in the search, jumps to the new job, and flashes its row so you can see exactly where it landed.',
      'The "show this job on the Pipeline" shortcut from Job Detail now also clears an active search instead of quietly failing to find the row.',
    ],
  },
  {
    version: 'v2.1527',
    date: '2026-08-10',
    title: 'Pick people with the keyboard',
    kind: 'feature',
    highlights: [
      'In the job people pickers — Add people on Edit Job, People on this job, and Schedule job — you can now type a few letters and press Enter to select the top match. The search clears so you can type the next name right away.',
      'Arrow keys move a highlight through the list, and Space or Enter checks or unchecks the highlighted person.',
    ],
  },
  {
    version: 'v2.1526',
    date: '2026-08-10',
    title: 'Developer login works on any local port',
    kind: 'fix',
    highlights: [
      'A development-only fix: the local dev sign-in now works no matter which port the dev server runs on, so several development sessions can run side by side.',
    ],
  },
  {
    version: 'v2.1525',
    date: '2026-08-10',
    title: 'Dispatch schedule updates instantly + Quick Assign upgrades',
    kind: 'feature',
    highlights: [
      'Scheduling a job or changing its time/day now shows up immediately — the page jumps to the day the work landed on and the calendar counts update right away. Coming back to the app also refreshes the schedule automatically.',
      'Assign work opens on the day you were viewing (not today), and the date row now shows weekday letters.',
      'New search box in Assign work finds teams and people by name, and teams are easier to tell apart: each has its own color, a header band with the member count, and a clear "✓ crew selected" state.',
      'The whole Assign work flow is keyboard-friendly: Tab moves day → search → people → time → instructions → Schedule, with arrow keys inside the day and people lists and Space/Enter to select.',
    ],
  },
  {
    version: 'v2.1524',
    date: '2026-08-10',
    title: 'Job Detail: clearer recorded-time section',
    kind: 'feature',
    highlights: [
      'Clock sessions are now grouped by person, with each person\'s total hours and session count shown in a header band — no more adding up rows by hand.',
      'Each session shows its day of the week ("Fri Jul 31st"), and hours line up in their own column so days are easy to scan.',
      '"Pending approval" and "Rejected" now appear as small colored tags next to the date; on multi-person jobs a "Total recorded" line sums the whole crew.',
    ],
  },
  {
    version: 'v2.1523',
    date: '2026-08-10',
    title: 'Bill send-backs work again',
    kind: 'fix',
    highlights: [
      'A server-side fault was silently breaking "Void Stripe invoice" / bill send-backs (every attempt failed with a connection error). Found during split-bill testing and fixed the same day.',
    ],
  },
  {
    version: 'v2.1522',
    date: '2026-08-10',
    title: 'Linking a matched customer works again',
    kind: 'fix',
    highlights: [
      'In the Edit Job create-customer dialog, the "Possible matches – link instead?" list only offers customers the job\'s owner actually owns — clicking a match now links it instead of silently failing.',
      'Linking a customer who has no email or phone on file no longer erases the contact info already typed on the job.',
    ],
  },
  {
    version: 'v2.1521',
    date: '2026-08-10',
    title: 'Search results: tidier one-line titles',
    kind: 'fix',
    highlights: [
      'Search result titles no longer wrap onto a second line (which could leave the trade tag stranded by itself) — long addresses now trail off with "…" and the status line below stays put.',
    ],
  },
  {
    version: 'v2.1520',
    date: '2026-08-10',
    title: 'Split a bill for multiple credit cards',
    kind: 'feature',
    highlights: [
      'When a customer wants to pay one bill with two (or up to four) cards, open the bill and click "Split bill…" — the original Stripe bill is voided and replaced by smaller bills, each with its own pay link.',
      'Type the first part and the last part fills in automatically; every part flips to Paid on its own, and the job goes to Paid in Full when the last part clears.',
      'New guide: "How do I split a bill so a customer can pay with multiple cards".',
    ],
  },
  {
    version: 'v2.1519',
    date: '2026-08-10',
    title: 'Dispatch mode: richer job picker',
    kind: 'feature',
    highlights: [
      'The "Add job to schedule" picker in Dispatch mode now shows the same detailed rows as other job searches: pipeline status chips, the money rail with paid/unpaid recency, work-line summaries, and finished jobs grouped at the bottom.',
    ],
  },
  {
    version: 'v2.1518',
    date: '2026-08-10',
    title: 'Mobile search stays out of the status bar',
    kind: 'fix',
    highlights: [
      'On iPhones, opening the header search no longer jumps the search box up over the clock and status bar — it now lands right on the header row, below the notch.',
    ],
  },
  {
    version: 'v2.1517',
    date: '2026-08-10',
    title: 'Dev login: fixed sign-in account',
    kind: 'infra',
    highlights: [
      'The development-only login tool now always signs in as the owner account instead of whatever email was typed or passed in the URL.',
      'No change for regular users — this tool only exists when running the app in development mode.',
    ],
  },
  {
    version: 'v2.1516',
    date: '2026-08-10',
    title: 'Search results: cleaner rows on phones',
    kind: 'feature',
    highlights: [
      'On phone-width screens, search rows stack: the job or bid name gets the full width, and the stage chip, money, and this-week count sit on their own line below — no more squeezed, wrapping labels.',
      'Applies to every search in the app automatically; desktop is unchanged.',
    ],
  },
  {
    version: 'v2.1515',
    date: '2026-08-10',
    title: 'Search standard: the final sweep',
    kind: 'feature',
    highlights: [
      'Jobs → Billing and Job Summary number cells show the trade tag + J number; Documents job and bid rows get the standard identity, status chips, and full-dollar values.',
      'Searching by a Click number now works everywhere it is displayed (Billing, Job Summary, Parts), Submission & Followup rows show their bid numbers, and the Dispatch Settings job picker renders standard rows.',
    ],
  },
  {
    version: 'v2.1514',
    date: '2026-08-10',
    title: 'Schedule & Combine: standard job identity',
    kind: 'feature',
    highlights: [
      'Schedule job titles across the hub, pickers, Quick Assign, and day views now read J927 instead of a bare 927.',
      'The Combine/Separate candidate rows adopt the full standard search row — trade tag, plain J number, Pipeline stage, and the money rail.',
    ],
  },
  {
    version: 'v2.1513',
    date: '2026-08-10',
    title: 'Bid pickers: outcome and value at a glance',
    kind: 'feature',
    highlights: [
      'The bid lists on Counts, Takeoffs, Labor, Pricing, Cover Letter, Change Order, RFI, and Lien Release now use the standard search rows — trade tag, plain B number, project and address, plus the Won/Pending/Lost chip, bid value, and sent/due date on every row.',
      'Change Order, RFI, and Lien Release rows show the bid number for the first time.',
    ],
  },
  {
    version: 'v2.1512',
    date: '2026-08-10',
    title: 'Bids: search by number everywhere',
    kind: 'fix',
    highlights: [
      'Submission & Followup, Change Order, RFI, and Lien Release can now be searched by bid number — typing 356 or BP356 finds the bid.',
      'The Bid Board search now also matches prefixed numbers like BP356, not just the raw digits.',
    ],
  },
  {
    version: 'v2.1511',
    date: '2026-08-10',
    title: 'Seven more pickers: standard search rows',
    kind: 'feature',
    highlights: [
      'Job pickers in Dispatch Mode PO, Materials PO Generator, the paid-email preview, the Hours grid highlight, the Overhead office-job chooser, supply-house invoice allocation, and Create-job-from-estimate all adopt the standard search rows — trade tag, plain J number, Pipeline stage, money, and this-week count.',
      'The Overhead picker finally shows addresses, and three pickers that hardcoded the letter J now respect your configured prefixes.',
    ],
  },
  {
    version: 'v2.1510',
    date: '2026-08-10',
    title: 'Money modals: standard search rows with evidence',
    kind: 'feature',
    highlights: [
      'Assigning Mercury transactions to jobs, splitting bank transactions in Banking, and picking a Migrate-and-Delete target now use the standard search rows — trade tag, plain J/B numbers, Pipeline stage, revenue, paid recency, and this-week schedule count.',
      'These money-allocation decisions previously showed no financial evidence at all; the migrate bid picker also gains the outcome chip and bid value.',
    ],
  },
  {
    version: 'v2.1509',
    date: '2026-08-09',
    title: 'Hours & crew pickers: standard search rows',
    kind: 'feature',
    highlights: [
      'The Hours unassigned-day modal (both its searches), the day-audit modal, and the crew add-job modal now show search results the header-search way — trade tag, plain J/B numbers, Pipeline stage, money, and this-week schedule count on one line.',
    ],
  },
  {
    version: 'v2.1508',
    date: '2026-08-09',
    title: 'Task modals & session pickers: standard search rows',
    kind: 'feature',
    highlights: [
      'The Send-to-Dispatch and Send-to-Estimator modals, the session assign popover, the clock-strip session modal, and the add-to-job/bid modal now show search results the same way the header search does — trade tag, plain J/B numbers, Pipeline stage, money, and this-week schedule count.',
      'Square brackets around trade tags and doubled trade letters (JP927 next to a plum tag) are gone from all five.',
    ],
  },
  {
    version: 'v2.1507',
    date: '2026-08-09',
    title: 'Search: job stage and schedule at a glance',
    kind: 'feature',
    highlights: [
      'Job rows in the header search now show the Pipeline stage chip (Working, Billed, Paid, …) and how many schedule blocks the job has this week — e.g. "2 this wk".',
      'One shared search-row style now powers the header search, ready to roll out to every other job/bid picker in the app.',
    ],
  },
  {
    version: 'v2.1506',
    date: '2026-08-09',
    title: 'Search: easier-to-read rows',
    kind: 'feature',
    highlights: [
      'Trade tags in search results now use white text, and addresses drop their zip codes to keep rows short.',
    ],
  },
  {
    version: 'v2.1505',
    date: '2026-08-09',
    title: 'Clock In: cleaner job rows',
    kind: 'feature',
    highlights: [
      'Trade tags in the Clock In and Update Focus pickers lose their square brackets, and numbers read J927 instead of JP927 — the tag already says the trade.',
    ],
  },
  {
    version: 'v2.1504',
    date: '2026-08-09',
    title: 'Search: cleaner job and bid numbers',
    kind: 'feature',
    highlights: [
      'Since search results already show the trade tag, numbers now read J870 and B356 instead of JP870 and BP356.',
    ],
  },
  {
    version: 'v2.1503',
    date: '2026-08-09',
    title: 'Search: jobs and bids show their numbers right in the results',
    kind: 'feature',
    highlights: [
      'Job results in the header search show the job total, paid recency, and work lines inline.',
      'Bid results show their outcome — Won, Lost, Pending, Started, or Unsent — with the bid value and due or sent date.',
    ],
  },
  {
    version: 'v2.1502',
    date: '2026-08-09',
    title: 'Combine jobs: search results show the money too',
    kind: 'feature',
    highlights: [
      'Searching for a source or target job now shows each result\'s work lines, job total, and paid recency — the same summary box as the schedule picker.',
    ],
  },
  {
    version: 'v2.1501',
    date: '2026-08-09',
    title: 'Schedule: job search shows the money at a glance',
    kind: 'feature',
    highlights: [
      'Add job to schedule results now carry a summary box — job total, paid recency, and blocks this week — plus the specific work lines under each name.',
      'Office roles see dollars; field roles see the work and dates only.',
    ],
  },
  {
    version: 'v2.1500',
    date: '2026-08-09',
    title: 'Duplicate finder: each job shows its evidence',
    kind: 'feature',
    highlights: [
      'Every job in the duplicate-address list now shows its line items with the revenue total, and how long ago it was last paid.',
      'Picking which job to keep no longer requires opening either one.',
    ],
  },
  {
    version: 'v2.1499',
    date: '2026-08-09',
    title: 'Combine jobs: find duplicate addresses',
    kind: 'feature',
    highlights: [
      'A new Find duplicates button lists every address with more than one job, each with its billing-state chip — likely duplicates (pairs) first.',
      '"Keep this one" stages the pair on the Combine tab with the full summary; nothing merges until you confirm there.',
    ],
  },
  {
    version: 'v2.1498',
    date: '2026-08-09',
    title: 'Combine jobs: a tidier modal',
    kind: 'feature',
    highlights: [
      'The long explanation of what Combine does now sits behind an ⓘ info link — the searches, summary, and buttons fit on screen without scrolling.',
    ],
  },
  {
    version: 'v2.1497',
    date: '2026-08-09',
    title: 'Combine jobs: see every line item before you merge',
    kind: 'feature',
    highlights: [
      'A new Line items detail section lists each job\'s specific work lines — name, quantity, unit price, and extended amount — grouped by source and target.',
      'Short lists open automatically; long ones stay tucked behind a count so the confirm button stays in reach.',
    ],
  },
  {
    version: 'v2.1496',
    date: '2026-08-09',
    title: 'Combine jobs: see the combined card before you commit',
    kind: 'feature',
    highlights: [
      'The Combine summary now includes a Line items row — revenue and line count for each job.',
      'A new "New" column shows exactly what the combined job will hold: source plus target for every row.',
    ],
  },
  {
    version: 'v2.1495',
    date: '2026-08-09',
    title: 'Schedule: the job picker tells you which job is the live one',
    kind: 'feature',
    highlights: [
      'Add job to schedule now shows each job\'s billing state — Waiting, Working, Ready to Bill, Billed, or Paid — right on the row.',
      'Finished (billed/paid) jobs drop below a divider and grey out, so the active job is always the obvious pick.',
      'Searching up two jobs at the same address shows a warning so repeat customers don\'t trip you up.',
    ],
  },
  {
    version: 'v2.1494',
    date: '2026-08-09',
    title: 'Job Mode: Clock In works again',
    kind: 'fix',
    highlights: [
      'In Job Mode, the card\'s Clock In and Start First Job buttons were silently doing nothing. Both work again.',
      'The Job Mode guide gained a screen recording of starting your day — the Ready to start card through to clocked in.',
    ],
  },
  {
    version: 'v2.1493',
    date: '2026-08-09',
    title: 'Help: watch Bill Customer in action',
    kind: 'feature',
    highlights: [
      'The billing guide now has a screen recording of the Bill Customer modal — the Ready to Bill queue, the three billing method tabs, and the invoice preview.',
    ],
  },
  {
    version: 'v2.1492',
    date: '2026-08-09',
    title: 'Help: watch Save as Assembly in action',
    kind: 'feature',
    highlights: [
      'The takeoff assembly guide now has a screen recording — Save as Assembly from a fixture\'s part lines, adding an item with the one-box search, and saving to the shared book.',
    ],
  },
  {
    version: 'v2.1491',
    date: '2026-08-09',
    title: 'Help: watch scheduling in action',
    kind: 'feature',
    highlights: [
      'The scheduling guide now has a screen recording of adding a block on the People grid — the day cell, the job picker, and the time slider.',
    ],
  },
  {
    version: 'v2.1490',
    date: '2026-08-09',
    title: 'Help: watch Assign work in action',
    kind: 'feature',
    highlights: [
      'The Dispatch Mode guide now has a short screen recording of the Assign work flow — job, day, people, and a suggested time window, start to finish.',
    ],
  },
  {
    version: 'v2.1489',
    date: '2026-08-09',
    title: 'Help guides: more visual',
    kind: 'feature',
    highlights: [
      'The role "start here" guides and a few others gained illustrated example panels — pipeline states, attention pills, aging chips, and the Dispatch Mode tab bar drawn right in the guide.',
      'Screen recordings for the trickiest flows are planned next.',
    ],
  },
  {
    version: 'v2.1488',
    date: '2026-08-09',
    title: 'Inspections: permit portals with sign-ins built in',
    kind: 'feature',
    highlights: [
      'Quick Links are now Permit Portal cards — search by city, open the portal, and copy the shared username and password right from the card.',
      'Scheduled inspections show an "Open portal" button with copy-sign-in shortcuts when the address matches a city a portal serves.',
      'Edit Portals now stores the cities each portal covers, the shared sign-in, and a note.',
    ],
  },
  {
    version: 'v2.1487',
    date: '2026-08-09',
    title: 'Stale tally follow-up: easier on your phone',
    kind: 'feature',
    highlights: [
      'On phones, each transaction is now a card with big Assign and Backcharge buttons — no more sideways scrolling to reach them.',
      'New All / Stale filter with counts, a "N to sort" tally in the title, and an age tag on each transaction so you can see what\'s oldest at a glance.',
      'The header and filters stay put while you scroll the list.',
    ],
  },
  {
    version: 'v2.1486',
    date: '2026-08-09',
    title: 'Assign work: the gray button explains itself',
    kind: 'fix',
    highlights: [
      'Tapping the disabled Schedule button now tells you exactly what\'s missing — like "Choose a time window — tap a suggested window or set a Custom time" — instead of doing nothing.',
    ],
  },
  {
    version: 'v2.1485',
    date: '2026-08-09',
    title: 'Sign-in: no more dashboard flicker',
    kind: 'fix',
    highlights: [
      'Right after signing in, the app briefly showed the wrong set of pinned tabs and a half-empty dashboard, then jumped to the real one. It now waits the extra beat for your role and renders once, correctly.',
    ],
  },
  {
    version: 'v2.1484',
    date: '2026-08-09',
    title: 'Money cards: better on desktop too',
    kind: 'feature',
    highlights: [
      'The drill-downs are wider, keep the title and total pinned while you scroll, and get the same search, Biggest/Oldest sorting, and aging chips as the phone version.',
      'New aging strip up top — 0–14d, 15–30d, and 30d+ totals you can click to see just that money.',
      'Every section collapses now, and estimated upcoming payroll folds in with the rest.',
    ],
  },
  {
    version: 'v2.1483',
    date: '2026-08-09',
    title: 'Money cards: built for your phone',
    kind: 'feature',
    highlights: [
      'Accounts Receivable, Accounts Payable, and Not Billed Out now open as full-screen sheets on phones — the dollar amounts are always visible instead of hiding off the side of a table.',
      'Search all the items at once, sort by Biggest or Oldest with one tap, and read aging as color chips — green under 2 weeks, amber to a month, red past it.',
      'Sections stick while you scroll and collapse with a tap, with counts and subtotals on the header. Computers keep the full table view.',
    ],
  },
  {
    version: 'v2.1482',
    date: '2026-08-09',
    title: 'Clock In: readable in dark mode',
    kind: 'fix',
    highlights: [
      'The "Ready to clock in?" popup no longer shows white text on a white card in dark mode — it now follows your theme.',
    ],
  },
  {
    version: 'v2.1481',
    date: '2026-08-09',
    title: 'Dashboard: even spacing around My Schedule',
    kind: 'fix',
    highlights: [
      'The gap above the My Schedule card now matches the gap below it — the space between Clock In and My Schedule was about double.',
    ],
  },
  {
    version: 'v2.1480',
    date: '2026-08-09',
    title: 'Dashboard: Billing Pipeline starts collapsed',
    kind: 'fix',
    highlights: [
      'All three pipeline stages now load closed — you see the counts at a glance and open just the stage you\'re working.',
    ],
  },
  {
    version: 'v2.1479',
    date: '2026-08-09',
    title: 'Dashboard: bigger Job Report button text',
    kind: 'fix',
    highlights: [
      'The Job Report button next to Clock In is now easier to read — its label got a size bump in both the compact and clocked-in layouts.',
    ],
  },
  {
    version: 'v2.1478',
    date: '2026-08-09',
    title: 'Pipeline: Hide groups lists Account Man first',
    kind: 'fix',
    highlights: [
      'The Hide groups list now runs Account Man, then Development, then GC/Builder.',
    ],
  },
  {
    version: 'v2.1477',
    date: '2026-08-09',
    title: 'Pipeline: filter by Account Man',
    kind: 'feature',
    highlights: [
      'The ⋯ Filters group gains an "All Account Men" dropdown — zoom the board to one Account Man, or to jobs that have none.',
      'Hide groups… now sits right under the filter dropdowns, so everything that narrows the board lives in one place.',
    ],
  },
  {
    version: 'v2.1476',
    date: '2026-08-08',
    title: 'Pipeline: hide groups of jobs from the board',
    kind: 'feature',
    highlights: [
      'New in the Pipeline ⋯ menu: Hide groups… — hide any mix of GCs, Developments, or Account Men, and the board recounts as if they weren\'t there.',
      'A red "Hiding N groups" chip in the search bar keeps the filtered view honest; tap it to review or clear.',
      'Hides are per device and purely visual — nothing on the jobs changes.',
    ],
  },
  {
    version: 'v2.1475',
    date: '2026-08-08',
    title: 'Pipeline: quiet "Reports" on jobs with none',
    kind: 'fix',
    highlights: [
      'Jobs with no field reports show a muted "Reports" link instead of a bordered "0 Reports" button — jobs that do have reports now stand out at a glance.',
    ],
  },
  {
    version: 'v2.1474',
    date: '2026-08-08',
    title: 'Pipeline: long customer names line up properly',
    kind: 'fix',
    highlights: [
      'A customer or development name long enough to wrap onto two lines in the job column was showing centered — it now stays left-aligned like everything around it.',
    ],
  },
  {
    version: 'v2.1473',
    date: '2026-08-08',
    title: 'Help guides: little buttons and chips show their true colors',
    kind: 'fix',
    highlights: [
      'A few dozen mock buttons and chips in the help guides were rendering plain gray instead of their intended color — all fixed, and a new check keeps it from happening again.',
    ],
  },
  {
    version: 'v2.1472',
    date: '2026-08-08',
    title: 'Recently deleted shows what died at a glance',
    kind: 'feature',
    highlights: [
      'Every deletion now carries count chips — invoices and payments highlighted — plus the first few lines of what was inside, with no clicking.',
      'While a bulk-deletion alert is active, the deletions from that burst jump to the top with an amber stripe.',
    ],
  },
  {
    version: 'v2.1471',
    date: '2026-08-08',
    title: 'Recent Reports: leaner rows',
    kind: 'fix',
    highlights: ['Report rows no longer show the report type — just the job, time, and who filed it.'],
  },
  {
    version: 'v2.1470',
    date: '2026-08-08',
    title: 'Billing Pipeline: tap ⓘ to see how it works',
    kind: 'feature',
    highlights: [
      'A little i button next to the Billing Pipeline title opens a map of the whole flow — every stage, who taps what, and how subcontractor Collect Payment requests fit in.',
    ],
  },
  {
    version: 'v2.1469',
    date: '2026-08-08',
    title: 'Recent Reports is now a proper inbox',
    kind: 'feature',
    highlights: [
      'New reports show a blue dot and a "N new" badge; opened reports stay in the list, dimmed — nothing disappears until you tap ✓ Done.',
      'Done clears a report from the dashboard on every device (it stays in View all). Read state now follows you between phone and desktop.',
      'The Unread/All tabs and the "hide on refresh" checkbox are gone — one Mark all opened button and a Show opened link cover it.',
    ],
  },
  {
    version: 'v2.1468',
    date: '2026-08-08',
    title: 'infra: groundwork for the Recent Reports redesign',
    kind: 'infra',
    highlights: [
      'Behind-the-scenes plumbing so report read/done state follows you across devices. Nothing changes in the app yet — the new Recent Reports section lands in the next update.',
    ],
  },
  {
    version: 'v2.1467',
    date: '2026-08-08',
    title: 'Dashboard: clock section headers stay readable',
    kind: 'fix',
    highlights: [
      'The collapsed "Clocked in today / Jobs worked today" bar no longer squeezes its labels into broken text at certain window sizes.',
    ],
  },
  {
    version: 'v2.1466',
    date: '2026-08-08',
    title: 'Account Man on jobs',
    kind: 'feature',
    highlights: [
      'Edit Job gains an Account Man section: pick a team member and their communication level — Primary, Preferred, or Only communicator.',
      'The Account Man shows on Pipeline rows and Job Detail. "Only communicator" turns red with stripes across the job so everyone knows just the Account Man talks to that customer.',
      'The Account Man must be on the job’s team — removing them from the team clears the assignment automatically.',
    ],
  },
  {
    version: 'v2.1465',
    date: '2026-08-08',
    title: 'infra: groundwork for Account Man on jobs',
    kind: 'infra',
    highlights: [
      'Behind-the-scenes plumbing for assigning an Account Man to a job with a communication level. Nothing changes in the app yet — the feature lands in the next update.',
    ],
  },
  {
    version: 'v2.1464',
    date: '2026-08-08',
    title: 'Dashboard: Job Report label reads better',
    kind: 'fix',
    highlights: ['The compact Job Report button stacks its label on two lines so it fits its square neatly.'],
  },
  {
    version: 'v2.1463',
    date: '2026-08-08',
    title: 'Dashboard: two small cleanups',
    kind: 'fix',
    highlights: [
      'The compact Job Report button now just says "Job Report" — no icon.',
      'The My Time window no longer shows the long note about punch times and blue handles; everything works the same without it.',
    ],
  },
  {
    version: 'v2.1462',
    date: '2026-08-08',
    title: 'Dashboard: the tally button says what it is',
    kind: 'fix',
    highlights: [
      'While clocked in, the tall wrench button now reads "My Spend" under its icon — matching the Job Report button beside it.',
    ],
  },
  {
    version: 'v2.1461',
    date: '2026-08-08',
    title: 'Dashboard: one tidy row of action buttons',
    kind: 'feature',
    highlights: [
      'The tally wrench and a new compact Job Report button now sit on either side of Clock In — one row instead of two.',
      'While clocked in, Job Report grows to sit alongside both the Clock Out timer and Update Focus, so everything stays one thumb-reach tall.',
    ],
  },
  {
    version: 'v2.1460',
    date: '2026-08-07',
    title: 'Job Detail: tidier action buttons',
    kind: 'fix',
    highlights: [
      'The stamp buttons on Job Detail now read "Arrived" and "Leaving" — same actions, less crowding on phone screens. Posted notes still say "Arrived at job" / "Leaving job".',
    ],
  },
  {
    version: 'v2.1459',
    date: '2026-08-07',
    title: 'Task descriptions wrap while you type',
    kind: 'fix',
    highlights: [
      'The "What do you need?" box on Send a task to Dispatch (and the estimator task form) now grows with your text and wraps onto new lines — no more scrolling sideways to edit a long request.',
    ],
  },
  {
    version: 'v2.1458',
    date: '2026-08-07',
    title: 'Pipeline on your phone: cleaner addresses, more buttons',
    kind: 'feature',
    highlights: [
      'Job addresses in Converse, Universal City, Live Oak, Cibolo, Boerne, and Leon Valley now split neatly onto two lines — no more a lone "TX" hanging on its own line, for any city.',
      'Mobile job cards gain two shortcuts: a briefcase that opens Job Detail and a Share icon that texts the job to a teammate.',
      'The ⋯ menu on each card adds Google Maps and Week dispatch, so everything from the desktop row is reachable on your phone.',
    ],
  },
  {
    version: 'v2.1457',
    date: '2026-08-07',
    title: 'Signed-contract details wrap cleanly on phones',
    kind: 'fix',
    highlights: [
      'The "Signed as / Signed" line on signed contracts (and accepted estimates) no longer breaks mid-timestamp on narrow screens — each part moves to its own line whole.',
    ],
  },
  {
    version: 'v2.1456',
    date: '2026-08-07',
    title: 'Contract previews work on your phone',
    kind: 'fix',
    highlights: [
      'The Contract Book document preview now has a ← Contracts link to get back, and its toolbar no longer hides under the iPhone status bar.',
      'The document also fits phone screens better, and printing it now comes out clean.',
    ],
  },
  {
    version: 'v2.1455',
    date: '2026-08-07',
    title: 'GC Review: tap a teammate instead of typing their email',
    kind: 'feature',
    highlights: [
      'The GC Review email dialogs (Share all and per-GC Email…) now show your office teammates as tappable chips above the To field — one tap fills their email.',
      'Tap the selected chip again to clear it; typing any other address, inside or outside the company, still works exactly as before.',
    ],
  },
  {
    version: 'v2.1454',
    date: '2026-08-07',
    title: 'Jobs: shared links show a preview card',
    kind: 'feature',
    highlights: [
      'When you share a job, the link now unfurls in Messages as a card: job #, name, address, current status — and a street photo of the address when one exists.',
      'Tapping the card still opens the job in the app behind the teammate’s own login; the card itself shows nothing beyond the job #, name, address, and status.',
    ],
  },
  {
    version: 'v2.1453',
    date: '2026-08-07',
    title: 'infra: groundwork for rich share cards',
    kind: 'infra',
    highlights: [
      'Behind-the-scenes plumbing so shared job links can show a preview card (job #, name, address, and a photo of the address) in Messages. Nothing changes in the app yet — the upgrade lands in the next update.',
    ],
  },
  {
    version: 'v2.1452',
    date: '2026-08-07',
    title: 'Jobs: share a job by text',
    kind: 'feature',
    highlights: [
      'New Share button on every Pipeline row, in Job Detail, and in the mobile card ⋯ menu — it opens your phone’s share sheet with the job #, name, and address prefilled, plus a link that opens that job in the app.',
      'On desktop the same text and link copy to your clipboard instead.',
      'The link grants no access — your teammate signs in as themselves and sees only what their account allows.',
    ],
  },
  {
    version: 'v2.1451',
    date: '2026-08-07',
    title: 'Pipeline: progress changes in the activity list',
    kind: 'feature',
    highlights: [
      'When anyone updates a job\u2019s % complete, it now shows in the job\u2019s activity list \u2014 \u201cProgress 42% \u2192 55%\u201d with who and when.',
      'Works everywhere % is edited: Job Detail, Workflow stages, and the Forecast board.',
    ],
  },
  {
    version: 'v2.1450',
    date: '2026-08-07',
    title: 'housekeeping: weekly money plan closed out',
    kind: 'infra',
    highlights: [
      'The Weekly Money build plan is marked shipped \u2014 documentation only, nothing changes in the app.',
    ],
  },
  {
    version: 'v2.1449',
    date: '2026-08-07',
    title: 'Weekly money: email it weekly',
    kind: 'feature',
    highlights: [
      'The Weekly Money Movement report gains an Email this report box \u2014 pick a dev or controller, default next Monday 7 AM, Repeat weekly on by default.',
      'Each send covers the previous complete week, rebuilt fresh at send time; recipients see it on their My email schedule.',
    ],
  },
  {
    version: 'v2.1448',
    date: '2026-08-07',
    title: 'Weekly money: the delivery engine',
    kind: 'infra',
    highlights: [
      'The app can now hold scheduled Weekly Money Movement sends and deliver them automatically \u2014 rebuilt fresh at send time, dev/controller recipients only, with self-renewing weekly repeats.',
      'The Share controls appear in the report next.',
    ],
  },
  {
    version: 'v2.1447',
    date: '2026-08-07',
    title: 'Moneyfill: the close is complete',
    kind: 'feature',
    highlights: [
      'Four more queues finish the weekly close: unapplied deposits, supply invoices whose job splits don\u2019t cover the amount, worked jobs missing a % report, and jobs with no total.',
      'All eight queues load in parallel and share their counts with the Weekly Money report\u2019s confidence line.',
    ],
  },
  {
    version: 'v2.1446',
    date: '2026-08-07',
    title: 'Moneyfill: time queues',
    kind: 'feature',
    highlights: [
      'Two more weekly-close queues: approved field hours no job absorbs (priced at wage) and closed sessions still waiting for approval.',
      'Approve a pending session right from the queue, or jump to People \u2192 Hours to dig in.',
    ],
  },
  {
    version: 'v2.1445',
    date: '2026-08-07',
    title: 'Moneyfill: unsplit card charges queue',
    kind: 'feature',
    highlights: [
      'Moneyfill lists the week\u2019s card purchases that haven\u2019t been split to jobs, with a one-click path to Banking sorting to fix each.',
      'The Weekly Money report now shows a confidence line \u2014 the same unattributed totals \u2014 so you know when to trust the week.',
    ],
  },
  {
    version: 'v2.1444',
    date: '2026-08-06',
    title: 'Moneyfill: the weekly close',
    kind: 'feature',
    highlights: [
      'Moneyfill now opens with a Close out header for the previous week \u2014 how many money queues are at zero and how many dollars are still unattributed.',
      'Queue chips fill in as more queues arrive over the next updates.',
    ],
  },
  {
    version: 'v2.1443',
    date: '2026-08-06',
    title: 'Pipeline: the Weekly Money Movement report',
    kind: 'feature',
    highlights: [
      'A new report for devs and controllers shows each week’s money out and money in per job — and whether the spend bought % progress.',
      'Two lenses: Earned (value created vs cost) and Cash (collected vs spent), with jobs split into made-money and lost-money sections.',
      'Open it from the Pipeline group in the stage strip’s hamburger menu; step weeks with ‹ › and print any week.',
    ],
  },
  {
    version: 'v2.1442',
    date: '2026-08-06',
    title: 'groundwork: weekly money math',
    kind: 'infra',
    highlights: [
      'The server can now compute each week’s per-job money out and money in — the engine behind the upcoming Weekly Money report. No visible changes yet.',
    ],
  },
  {
    version: 'v2.1441',
    date: '2026-08-06',
    title: 'groundwork: job progress history',
    kind: 'infra',
    highlights: [
      'The app now keeps a history of every change to a job’s % complete — groundwork for the upcoming Weekly Money report. No visible changes yet.',
    ],
  },
  {
    version: 'v2.1440',
    date: '2026-08-06',
    title: 'planning: weekly money report',
    kind: 'infra',
    highlights: [
      'A build plan was drafted for an upcoming Weekly Money Movement report — which jobs made or lost money each week and how far they progressed — plus the Moneyfill queues to support it. Planning only; nothing changes in the app yet.',
    ],
  },
  {
    version: 'v2.1439',
    date: '2026-08-06',
    title: 'developer docs reorganized',
    kind: 'infra',
    highlights: [
      'The main technical reference was restructured so each section is a short summary that points to the right in-depth doc — no user-facing changes.',
    ],
  },
  {
    version: 'v2.1438',
    date: '2026-08-06',
    title: 'Weekly movement: email it to teammates',
    kind: 'feature',
    highlights: [
      'The Weekly movement report gains an Email this report box \u2014 pick a teammate, default next Monday 7 AM, Repeat weekly on by default.',
      'Each send covers the previous complete week, rebuilt fresh at send time; recipients see it on their My email schedule.',
    ],
  },
  {
    version: 'v2.1437',
    date: '2026-08-06',
    title: 'Weekly movement: the delivery engine',
    kind: 'infra',
    highlights: [
      'The app can now hold scheduled Weekly movement report sends and deliver them automatically \u2014 each covering the previous complete week, rebuilt fresh at send time, with self-renewing weekly repeats.',
      'The Share controls appear in the Weekly movement report next.',
    ],
  },
  {
    version: 'v2.1436',
    date: '2026-08-06',
    title: 'Pipeline: the Weekly movement report',
    kind: 'feature',
    highlights: [
      'A new Weekly movement report shows every job that entered a stage in a chosen week \u2014 grouped by stage, with the day, who moved it, and the job\u2019s value.',
      'Sent-back moves get their own section, and app-made moves (like Stripe payments) show as Automatic.',
      'Open it from the Pipeline group in the stage strip\u2019s hamburger menu; step weeks with \u2039 \u203a and print any week.',
    ],
  },
  {
    version: 'v2.1435',
    date: '2026-08-06',
    title: 'Complete pipeline history under the hood',
    kind: 'infra',
    highlights: [
      'Every job status change is now recorded \u2014 including jobs going Paid, which previously left no trace. Groundwork for the upcoming Weekly movement report.',
    ],
  },
  {
    version: 'v2.1434',
    date: '2026-08-06',
    title: 'GC Review: jobs sorted by address',
    kind: 'feature',
    highlights: [
      'Each GC\u2019s jobs now list in address order with the street address in small under the job name \u2014 same-site work sits together.',
      'Emailed statements (including scheduled ones) use the same order.',
    ],
  },
  {
    version: 'v2.1433',
    date: '2026-08-06',
    title: 'GC Review: Share all stands out',
    kind: 'fix',
    highlights: [
      'The Share all button at the top of GC Review is now blue, marking it as the primary action next to Print all.',
    ],
  },
  {
    version: 'v2.1432',
    date: '2026-08-06',
    title: 'Standing report copies show on the recipient\u2019s email schedule',
    kind: 'feature',
    highlights: [
      'Teammates given a standing GC Review copy now see it on their own Settings \u2192 My email schedule \u2014 green chips on the weekdays it arrives.',
    ],
  },
  {
    version: 'v2.1431',
    date: '2026-08-06',
    title: 'GC Review: standing report copies for teammates',
    kind: 'feature',
    highlights: [
      'Devs can now give anyone a standing copy of the whole GC Review report \u2014 pick the person (or an outside email), toggle the weekdays, set the time.',
      'Mon + Wed for a Master? Two clicks. Each copy rebuilds fresh at send time and runs until you remove it.',
      'Standing copies show as one line per person with Edit / Remove, in the dialog and in the pending-sends list.',
    ],
  },
  {
    version: 'v2.1430',
    date: '2026-08-06',
    title: 'Groundwork for standing report copies',
    kind: 'infra',
    highlights: [
      'Internal plumbing for sending the GC Review report to chosen teammates on chosen weekdays \u2014 the picker UI arrives next.',
    ],
  },
  {
    version: 'v2.1429',
    date: '2026-08-06',
    title: 'GC Review: Schedule send works first-click',
    kind: 'fix',
    highlights: [
      'Flipping to Schedule\u2026 now pre-fills tomorrow 7:00 AM Central \u2014 previously the empty date made Schedule send look like it did nothing.',
    ],
  },
  {
    version: 'v2.1428',
    date: '2026-08-06',
    title: 'Scheduled GC statements join My email schedule',
    kind: 'feature',
    highlights: [
      'GC statement sends you schedule now show on Settings \u2192 Your account \u2192 My email schedule \u2014 green chips with the GC and destination address, weekly chains labeled.',
      'Devs see all pending statement sends in the global email schedule.',
    ],
  },
  {
    version: 'v2.1427',
    date: '2026-08-06',
    title: 'GC Review: schedule statement emails',
    kind: 'feature',
    highlights: [
      'The Email\u2026 and Share all dialogs gain Send now | Schedule\u2026 \u2014 pick a date and time (Central) and optionally Repeat weekly.',
      'Scheduled statements rebuild fresh at send time; a GC with nothing outstanding is skipped, never emailed empty.',
      'Your pending sends list at the top of GC Review with a Cancel on each \u2014 cancelling ends a weekly repeat.',
    ],
  },
  {
    version: 'v2.1426',
    date: '2026-08-06',
    title: 'Scheduled GC statements: the delivery engine',
    kind: 'infra',
    highlights: [
      'The app can now hold scheduled GC statement sends and deliver them automatically \u2014 rebuilt fresh at send time, with weekly repeats that renew themselves.',
      'A GC with nothing outstanding is skipped, never emailed an empty statement.',
      'The scheduling controls appear in GC Review in the next update.',
    ],
  },
  {
    version: 'v2.1425',
    date: '2026-08-06',
    title: 'Groundwork for scheduled GC statements',
    kind: 'infra',
    highlights: [
      'The app can now rebuild the whole GC Review report on the server \u2014 verified to the penny against the live board \u2014 so scheduled GC statement emails can send with nobody at a keyboard.',
      'Scheduling controls arrive in a following update.',
    ],
  },
  {
    version: 'v2.1424',
    date: '2026-08-06',
    title: 'Named the Report Subscriptions system',
    kind: 'infra',
    highlights: [
      'The machinery behind scheduled report emails (Billed report, dispatch-day emails, My email schedule) now has a name and a reference doc, paving the way for schedulable GC statements.',
    ],
  },
  {
    version: 'v2.1423',
    date: '2026-08-06',
    title: 'GC Review: tidier layout',
    kind: 'feature',
    highlights: [
      'Each GC row\u2019s Email\u2026 / Copy / Print actions now live in one Share dropdown.',
      'Share all and Print all sit together, centered under the title, with the Include Collections toggle centered below them.',
      'The description line is shorter \u2014 just what the view shows.',
    ],
  },
  {
    version: 'v2.1422',
    date: '2026-08-06',
    title: 'Pipeline: clearer section labels in the section-tools menu',
    kind: 'fix',
    highlights: [
      'The Working / Billed Awaiting Payment / Paid in Full group labels in the hamburger dropdown are now centered and bolder, so it reads clearly which section each tool belongs to.',
    ],
  },
  {
    version: 'v2.1421',
    date: '2026-08-06',
    title: 'Pipeline: section tools joins the stage strip',
    kind: 'feature',
    highlights: [
      'The section-tools button now sits right beside Waiting → Working → … so it reads as part of the strip, and wears a hamburger menu icon.',
      'Same dropdown as before — Capable of Being Billed, GC Review, Accounts Receivable, Share / Print, and the notification settings.',
    ],
  },
  {
    version: 'v2.1420',
    date: '2026-08-06',
    title: 'GC Review: share the whole report at once',
    kind: 'feature',
    highlights: [
      'A new Share all button at the top of GC Review opens one place to print / save the entire report as a PDF or email it from the app.',
      'The email carries every GC section — jobs, bill-sent dates, amounts owed — plus the grand total, and can go to any address, inside or outside the company.',
      'Sent from the app with your email as reply-to, same as per-GC statements.',
    ],
  },
  {
    version: 'v2.1419',
    date: '2026-08-06',
    title: 'Pipeline: section tools in one dropdown at the top',
    kind: 'feature',
    highlights: [
      'A new dropdown on the stage jump bar (magnifying-glass icon, left of Waiting → Working → …) collects the buttons that live on the section headers down the board.',
      'Open Capable of Being Billed, GC Review, Accounts Receivable (with its unallocated-deposits count), Share / Print, and the notification settings without scrolling.',
      'Each item follows the same permissions as the button it mirrors.',
    ],
  },
  {
    version: 'v2.1418',
    date: '2026-08-06',
    title: 'Email a GC statement straight from the app',
    kind: 'feature',
    highlights: [
      'GC Review gains an Email… button per GC — the app sends the same statement the Copy button builds, no pasting needed.',
      'The To address pre-fills from the GC’s customer record and stays editable, and replies come back to your own inbox.',
      'Each GC row shows when a statement was last sent, so the office can see who’s already been statemented.',
    ],
  },
  {
    version: 'v2.1417',
    date: '2026-08-06',
    title: 'Groundwork for emailing GC statements from the app',
    kind: 'infra',
    highlights: [
      'The app now keeps a record of every GC statement it emails \u2014 who sent it, to whom, and when.',
      'The Email button itself ships next.',
    ],
  },
  {
    version: 'v2.1416',
    date: '2026-08-06',
    title: 'Copy a GC statement straight into your email',
    kind: 'feature',
    highlights: [
      'GC Review gains a Copy for email button per GC \u2014 paste into Gmail, Outlook, or Apple Mail and it lands as a clean table.',
      'The statement shows what GCs ask for: job address, the date the bill was sent, and the amount owed, with a total.',
      'A suggested subject line rides along at the top of the copy.',
    ],
  },
  {
    version: 'v2.1415',
    date: '2026-08-06',
    title: 'Photos requests stop piling up on jobs that already have a folder',
    kind: 'fix',
    highlights: [
      'Asking Dispatch for a photos folder on a job that already has one now tells you so instead of filing a note nobody can clear.',
      'Old requests like that close themselves the next time Dispatch opens the inbox, so the list stops carrying dead items.',
    ],
  },
  {
    version: 'v2.1414',
    date: '2026-08-06',
    title: 'Fix: "no customer photos" showing on jobs that had photos',
    kind: 'fix',
    highlights: [
      'On My Schedule, the camera icon turned red — "no photos link, tap to ask Dispatch" — for any scheduled job that was already billed or paid, even when the job had a photos link. Tapping it filed a duplicate request Dispatch then had to close by hand.',
      'The icon now reads the job’s real photos link, so it only turns red when the link is genuinely missing.',
      'Leave Report on those same rows now fills in the job number and address instead of showing "—".',
    ],
  },
  {
    version: 'v2.1413',
    date: '2026-08-05',
    title: 'Contract library: cleaner document cards on phones',
    kind: 'feature',
    highlights: [
      'On phones, each library document now reads as a tidy card: name first, its packet and tags on the next line, and the buttons centered underneath.',
      'The version line is quieter — "from last edit" is gone (it was the normal case); dates you set manually still say so.',
    ],
  },
  {
    version: 'v2.1412',
    date: '2026-08-05',
    title: 'Fix: assigning a job from your phone works again',
    kind: 'fix',
    highlights: [
      'Tapping Assign in the Dashboard clock list on a phone opened the "Assign job or bid" box mostly off the edge of the screen, so you couldn’t search. It now always opens fully on screen.',
      'The same box also stays on screen everywhere else it appears (People → Hours, the day editor).',
    ],
  },
  {
    version: 'v2.1411',
    date: '2026-08-05',
    title: 'Contracts: one Contract library, and packets you can see through',
    kind: 'feature',
    highlights: [
      'Contract Book and Manage templates merged into one "Contract library" with two tabs: Documents (every agreement, how many people have it, Send to… right there) and Packets — the new name for templates.',
      'Packets are managed side-by-side: pick a packet, see its documents as checkboxes and who’s assigned, and before saving you’re told exactly what will happen ("added for the 4 assigned people without it, created as unsent").',
      'Assign packets now uses checkboxes with the same plain-English preview, and Unassign moved into each packet’s ⋯ menu.',
      'Documents that were only ever sent one-off show under "Outside the library" so nothing is invisible anymore.',
    ],
  },
  {
    version: 'v2.1410',
    date: '2026-08-05',
    title: 'Contracts: send one document to one person in two clicks',
    kind: 'feature',
    highlights: [
      'Every agreement card in the Agreements panel now has a "Send to…" button — pick a person from the roster (split into "hasn’t received it yet" and "already has it") and the send email opens ready to go. No template assignment needed.',
      'Add document now starts with a simple choice: pick a document from the Contract Book (name, text, and version fill in automatically — then just Send now or Save for later) or open the full custom form.',
      'Send emails prefill the person’s address from the roster in more places.',
    ],
  },
  {
    version: 'v2.1409',
    date: '2026-08-05',
    title: 'Fix: archived people no longer show as active on Contracts',
    kind: 'fix',
    highlights: [
      'People whose accounts were archived (like Bill, Juan, and Joseph) were still appearing in the active Contracts list because a linked roster entry stayed active. Anyone archived anywhere now lands in the Archived section.',
      'The filter counts got honest too \u2014 Needs attention stopped counting people you\u2019d already archived.',
    ],
  },
  {
    version: 'v2.1408',
    date: '2026-08-05',
    title: 'Contracts: tidier documents beside the Agreements panel, and an Archived section',
    kind: 'feature',
    highlights: [
      'With the Agreements panel open, a person\u2019s documents now show as the same tidy cards as on phones \u2014 no more squeezed table with wrapped buttons.',
      'Archived people now appear in their own collapsed "Archived" section at the bottom of the list, keeping their contract history one tap away without cluttering the active roster.',
      'Searching includes archived people automatically, and the mid-size table got small cleanups (one-line action buttons, shorter headers).',
    ],
  },
  {
    version: 'v2.1407',
    date: '2026-08-05',
    title: 'Contracts: see each agreement\u2019s signatures at a glance',
    kind: 'feature',
    highlights: [
      'On desktop, a new Agreements panel sits beside the people list: every agreement with how many people are assigned versus signed, and a progress bar.',
      'Expand an agreement to see each person\u2019s status \u2014 when it was sent, when they last opened the signing page, and when they signed. "Viewed, not signed" means a nudge should do it; "never opened" means resend or call.',
      'Opening a signing link now records the view, starting today \u2014 older opens show a dash. Tap a name to jump to that person in the list.',
    ],
  },
  {
    version: 'v2.1406',
    date: '2026-08-05',
    title: 'Contracts: filter buttons and a cleaner table',
    kind: 'feature',
    highlights: [
      'New filter buttons above the people list \u2014 Needs attention, Waiting, Done, Everyone \u2014 each with a count. The tab opens on Needs attention so the people to chase are front and center, and your choice is remembered on that device.',
      'The documents table slimmed from eight columns to four: rarely-used details (version number, reference link, note) tuck under the document name, and status shows as the same colored chips as the list.',
    ],
  },
  {
    version: 'v2.1405',
    date: '2026-08-05',
    title: 'Contracts works properly on phones',
    kind: 'feature',
    highlights: [
      'On a phone, a person\'s contract documents now show as cards with the Send button, Dashboard checkbox, and menu always on screen \u2014 before, those controls were cut off past the right edge.',
      'Each person\'s status now shows right beside their name as small counts \u2014 like "1 unsent \u00b7 2 signed" \u2014 instead of a lone dot at the far right of the screen (which phones couldn\'t see at all).',
    ],
  },
  {
    version: 'v2.1404',
    date: '2026-08-05',
    title: 'Contracts: a ? guide built into the page',
    kind: 'feature',
    highlights: [
      'A small i button next to the Contracts heading now explains the tab in plain English: what Send / Resend does, what the Dashboard checkbox reminds people about, what the red / yellow / green status dots mean, and how the Applied version date works.',
    ],
  },
  {
    version: 'v2.1403',
    date: '2026-08-05',
    title: 'Contracts: Send for signature fills in the email for you',
    kind: 'fix',
    highlights: [
      'Sending a contract for signature now starts with the person\'s email from the roster already filled in instead of a blank box. You can still change it before sending.',
    ],
  },
  {
    version: 'v2.1402',
    date: '2026-08-05',
    title: 'Stages mobile cards: every job action behind one \u22ef button',
    kind: 'feature',
    highlights: [
      'On the Stages mobile cards, a new \u22ef button at the end of each card\'s icon row slides up a menu with everything the desktop row offers \u2014 View job, Edit job, Activity and notes, Calendar, Click Tooling, and the section\'s billing tools (AIA, hazmat, lien, collections) where they apply.',
      'These actions used to hide behind tapping the card body with nothing telling you so; now there\'s a visible button. Tapping the card still opens the message thread.',
    ],
  },
  {
    version: 'v2.1401',
    date: '2026-08-05',
    title: 'Linked crew window reads cleanly on phones',
    kind: 'feature',
    highlights: [
      'The Linked crew window no longer squeezes into a cramped table. The job, date, and time show once at the top, and below that is a simple list of crew members — each with their Unlink and Remove buttons always visible.',
      'Crews linked across several days get one card per day. A small "outside week" tag replaces the old Hub week column, appearing only where it applies.',
      'Adding a person is one row: pick a name, tap Add.',
    ],
  },
  {
    version: 'v2.1400',
    date: '2026-08-05',
    title: 'Fix: saving a Contract Book entry errored',
    kind: 'fix',
    highlights: [
      'Saving a Contract Book document briefly failed with a "function does not exist" error after the version-date update. Saves work again; nothing was lost.',
    ],
  },
  {
    version: 'v2.1399',
    date: '2026-08-05',
    title: 'Contract Book: set a document\'s official version date',
    kind: 'feature',
    highlights: [
      'Each Contract Book entry now shows its version date, and the edit form lets you pin it: keep "From last edit" or switch to "Custom date" — the custom date becomes the document\'s official version date everywhere, and editing the text won\'t move it.',
      'The pickers and Applied version column in People → Contracts use this date for everyone assigned the document. A person\'s own custom applied date still wins over it.',
      'Manually set dates show with a dotted underline, in the book and in the roster.',
    ],
  },
  {
    version: 'v2.1398',
    date: '2026-08-05',
    title: 'Contracts: set the Applied version date yourself',
    kind: 'feature',
    highlights: [
      'The Applied version date on a staff contract used to follow the Contract Book\'s last edit — editing the book moved everyone\'s date. Now the Edit document window has an Applied date setting: keep "From book edit" or switch to "Custom date" and pick the date the contract really applied.',
      'Custom dates show in the Applied version column with a dotted underline — hover to confirm it was set manually. Book edits never move them.',
      'The Edit document window also got a light refresh: paired fields on wide screens and Delete moved to the left of the footer.',
    ],
  },
  {
    version: 'v2.1397',
    date: '2026-08-04',
    title: 'Bids Counts: deleting a row now names the fixture or tie-in',
    kind: 'feature',
    highlights: [
      'The delete confirmation on a Counts row now says which item you\'re removing — for example, Remove "FD" (count 7)? — instead of just "Remove this row?", so it\'s easy to check you have the right one before confirming.',
    ],
  },
  {
    version: 'v2.1396',
    date: '2026-08-04',
    title: 'Edit Job: the + for another payment line moved below the list',
    kind: 'feature',
    highlights: [
      'In ③ Payments received, the blue + used to sit inside the payment row between the pencil and the trash icon — it looked like it belonged to that row. It now sits centered below the payment lines, making it clear it adds a new line.',
      'Nothing else changed: the pencil still opens a row\'s details and the trash still removes it.',
    ],
  },
  {
    version: 'v2.1395',
    date: '2026-08-04',
    title: 'Takeoffs: "Save & add" on a part line actually adds the part now',
    kind: 'fix',
    highlights: [
      'Creating a new part from a takeoff part line saved the part to the catalog but left the line empty — the part never got attached. It now lands on the line, with its catalog price, every time.',
      'The other create-a-part spots (Add assembly, Edit assembly, Add parts to assembly) were unaffected and keep working as before.',
    ],
  },
  {
    version: 'v2.1394',
    date: '2026-08-04',
    title: 'Takeoffs: creating a part from Add-parts-to-assembly adds it too',
    kind: 'feature',
    highlights: [
      'The last hold-out: creating a new part from the Add-parts-to-assembly picker now adds it straight to the assembly (at the quantity in the box, default 1) instead of just selecting it — matching every other Takeoffs picker.',
      'The button now says "Save & add" there too. Need a different quantity? Adjust it afterwards in Edit Assembly.',
    ],
  },
  {
    version: 'v2.1393',
    date: '2026-08-04',
    title: 'Other jobs: duplicate-marked bank transactions no longer count as materials',
    kind: 'fix',
    highlights: [
      'Same fix as v2.1317, applied to the other side of the ledger: duplicate-marked Mercury transactions that were split to regular jobs no longer count into the "other jobs" materials totals.',
    ],
  },
  {
    version: 'v2.1392',
    date: '2026-08-04',
    title: 'Takeoffs: the part form says what Save really does',
    kind: 'feature',
    highlights: [
      'Creating a part from a Takeoffs picker already drops the new part straight into the line or assembly you came from — but the button just said "Save," so it read like you\'d have to go find the part afterwards. It now says "Save & add."',
      'From the Add-parts-to-assembly window it says "Save & select" — the new part lands selected in the picker so you can set the quantity before adding.',
      'Editing an existing part keeps the plain "Save."',
    ],
  },
  {
    version: 'v2.1391',
    date: '2026-08-04',
    title: 'Dropdowns you can actually drive from the keyboard',
    kind: 'feature',
    highlights: [
      'Every search dropdown in the app (supply house pickers, part pickers, assignees…) now works the way you\'d expect: type a few letters and the first match highlights itself — Enter picks it, no arrowing first.',
      'Arrow keys walk the list one row at a time (wrapping at the ends) instead of jumping back to the top; Spacebar picks the highlighted option when you haven\'t typed anything.',
      'Tab picks the highlighted option, closes the list, and moves you to the next field — so filling a Prices row is type, Tab, type, Tab. Escape still closes without choosing.',
    ],
  },
  {
    version: 'v2.1390',
    date: '2026-08-04',
    title: 'Followup: a logged call fulfills an overdue promise',
    kind: 'fix',
    highlights: [
      'Quick-logging a call on a builder whose promised follow-up was already due now clears the overdue flag — they stop pinning to the top of the queue, because you just talked to them.',
      'Future promises stay put: texting a builder today doesn\'t cancel "call them Tuesday about the award."',
    ],
  },
  {
    version: 'v2.1389',
    date: '2026-08-04',
    title: 'Call sessions: walk every bid while the GC is on the phone',
    kind: 'feature',
    highlights: [
      'New 📞 Start call session button on every builder card: the number to dial up top, then each open bid with one-tap outcomes — Still pending, Won, Lost (with a reason), or Rebid/RFQ — plus optional notes.',
      'One save logs the whole call: the builder\'s contact history, a dated note on every bid you touched, and any Won/Lost outcomes — set for real, no separate edit step.',
      'Before you hang up, promise the next follow-up (Tomorrow / Next week / In 2 weeks / pick a date). The call queue now honors those promises: due follow-ups float to the top with a red badge, and builders promised a later date wait below until their day.',
    ],
  },
  {
    version: 'v2.1388',
    date: '2026-08-04',
    title: 'Followup: quick-logged calls appear in the contact log instantly',
    kind: 'fix',
    highlights: [
      'After logging a call on a builder card, the new entry now shows up in the General contact list immediately — previously it only appeared after collapsing and reopening the card.',
    ],
  },
  {
    version: 'v2.1387',
    date: '2026-08-04',
    title: 'One Followup tab: Builder Review and Submission & Followup merge',
    kind: 'feature',
    highlights: [
      'The two follow-up tabs are now one — Followup — with a toggle between "By builder" (the call queue) and "By status" (the outcome tables, followup sheets, and scripts). Old links keep working.',
      'The ↗ next to any GC/Builder name on the status tables jumps straight to that builder\'s card on the queue; the stale-days threshold is shared between both lenses.',
      'Printable call sheets: one page per builder (their people, numbers, and open bids with last-update ages), or the whole queue in call order from the toolbar.',
      'New help guide: Settings → Help → "follow up with builders on their bids".',
    ],
  },
  {
    version: 'v2.1386',
    date: '2026-08-04',
    title: 'Builder Review becomes a real call queue',
    kind: 'feature',
    highlights: [
      'Every unsent and pending bid on a builder card now shows when it last got an update, and turns red past your "stale after N days" threshold (set it once in the toolbar — it sticks).',
      'Log a call in one line: pick Phone/Text/Email, type what they said, and hit Log — it records one contact for the builder and stamps every checked bid at once.',
      'New chips on each builder: win hit-rate and open pipeline dollars. The builder\'s phone number is now visible and tappable on the card header.',
      'Snooze a builder ("awarding after board meeting — check back Aug 18") and they step out of the call queue until their wake date, visible to the whole team. Builders with no bids yet fold into a Quiet builders group at the bottom.',
    ],
  },
  {
    version: 'v2.1385',
    date: '2026-08-04',
    title: 'Builder Review: PIA flags are now shared with your whole team',
    kind: 'feature',
    highlights: [
      'The PIA checkbox on Builder Review now saves to the database — flag a builder once and everyone sees it, on every device. Your existing flags move over automatically the first time you open the tab.',
      'The "last contact" ordering under the hood was consolidated and hardened; sorting is unchanged, ties now break alphabetically.',
      'First step of the Followup revamp — the Builder Review and Submission & Followup tabs are merging into one follow-up surface over the next updates.',
    ],
  },
  {
    version: 'v2.1384',
    date: '2026-08-04',
    title: 'Working board loads faster',
    kind: 'fix',
    highlights: [
      'The Working board and its Inbox tab badge were quietly re-fetching their columns and card placements dozens of times while the Bids page refreshed — now they load once and only re-fetch when your bids actually change.',
    ],
  },
  {
    version: 'v2.1383',
    date: '2026-08-04',
    title: 'Unsent/Working board no longer loses your column layout',
    kind: 'fix',
    highlights: [
      'Switching trades (Plumbing / Electrical / HVAC) while on the Unsent/Working tab could silently wipe your saved column layout and dump every bid back into Inbox. That can no longer happen.',
      'The board now only clears a saved position after confirming the specific bid actually left your board — it was sent, won or lost, or reassigned to someone else.',
      'If your board was already reset by this bug, drag your bids back into place once — the new layout will stick.',
    ],
  },
  {
    version: 'v2.1382',
    date: '2026-08-04',
    title: 'Customer review: see the hours behind each customer',
    kind: 'feature',
    highlights: [
      'On the Bid Board\'s Customer review, click any customer to see who logged their hours — a ranked contributor list with each person\'s share, split between estimating and job time.',
      'Below that, the hours are grouped by bid and job, biggest first — expand one to see the individual clock sessions (day, person, in/out times, hours).',
      'The customer table also got a polish: hover highlighting, a header that stays put while you scroll, and it scrolls sideways on small screens instead of cutting off the hours columns.',
    ],
  },
  {
    version: 'v2.1381',
    date: '2026-08-04',
    title: 'Edit schedule block: Remove button',
    kind: 'feature',
    highlights: [
      'The Edit schedule block window now has a Remove button in the bottom-left corner — take a block off the schedule right where you edit it, on the week grids and in Dispatch Mode.',
      'A confirmation asks first, and only that one block is removed — a linked crew-mate\'s block stays put.',
    ],
  },
  {
    version: 'v2.1380',
    date: '2026-08-04',
    title: 'Moneyfill access comes with the controller role',
    kind: 'feature',
    highlights: [
      'Anyone made a controller now gets the bank-transfer labeling queue on Moneyfill automatically — no separate grant step.',
      'If a controller is demoted or archived, the automatic access is removed; grants a dev made by hand are left alone.',
    ],
  },
  {
    version: 'v2.1379',
    date: '2026-08-03',
    title: 'Move day chips now reach forward too',
    kind: 'fix',
    highlights: [
      'The Move day row in the Edit schedule block modal now offers yesterday, today, and the next two days — so pushing a job to tomorrow is one tap, not a calendar trip.',
      'Any other date, further back included, is still right there behind the calendar button.',
    ],
  },
  {
    version: 'v2.1378',
    date: '2026-08-03',
    title: 'Moneyfill: a money page for controllers',
    kind: 'feature',
    highlights: [
      'New Moneyfill page (the money-bill icon next to the Quickfill heart) for devs and controllers — financial queues worked to zero, starting with Bank transfers needing attribution.',
      'Bank transfers needing attribution moved there from Quickfill, so the daily Quickfill loop no longer shows org-level spending.',
      'Controllers still need the banking-attribution grant from a dev to see the queue itself; the page explains who to ask.',
    ],
  },
  {
    version: 'v2.1377',
    date: '2026-08-03',
    title: 'Move a scheduled block to another day',
    kind: 'feature',
    highlights: [
      'The Edit schedule block modal gains a "Move day" row: tap one of the last three days to back-date a block, or use the calendar button to pick any other date.',
      'The date at the top updates as you pick, a banner names the day it is moving to, and the button reads "Move and save" so a day change is never silent.',
      'Overlaps are checked against the day it is moving to, and a crew block scheduled across several days is left alone rather than pulled onto one date.',
    ],
  },
  {
    version: 'v2.1376',
    date: '2026-08-03',
    title: 'Quickfill: a shorter name for Tomorrow\'s Schedule',
    kind: 'fix',
    highlights: [
      'The Quickfill section called "Tomorrow\'s Schedule (Dispatch hub)" is now just "Tomorrow\'s Schedule" — matching what its own history popup and the help guides already called it.',
    ],
  },
  {
    version: 'v2.1375',
    date: '2026-08-03',
    title: 'Add job to schedule: smarter search',
    kind: 'feature',
    highlights: [
      'Search results now highlight the matching part of what you typed, so you can see at a glance why each job matched.',
      'A new # button next to the search box searches job numbers only (C# and HCP) — type "92" and job 92 tops the list, followed by 926, 925, and the rest.',
    ],
  },
  {
    version: 'v2.1374',
    date: '2026-08-03',
    title: 'Bid Board: due date, estimator, last contact together',
    kind: 'feature',
    highlights: [
      'The estimator column moved next to the due date, so when a bid is due, who owns it, and when you last touched it now read side by side.',
    ],
  },
  {
    version: 'v2.1373',
    date: '2026-08-03',
    title: 'Eight missing entries restored to the release history',
    kind: 'infra',
    highlights: [
      'Five updates that shipped without a history entry — including the hazmat fee edit, void, and notice-email work — are documented again.',
      'Three version numbers that had been used for two different releases each now read as one entry apiece, with nothing dropped.',
      'The checks added yesterday now run with no exceptions left, so a lost entry fails immediately.',
    ],
  },
  {
    version: 'v2.1372',
    date: '2026-08-03',
    title: 'Under the hood: the changelog now guards itself',
    kind: 'infra',
    highlights: [
      'Automated checks now catch a release note that goes missing, or a version number used twice, before it reaches everyone.',
    ],
  },
  {
    version: 'v2.1371',
    date: '2026-08-03',
    title: 'Linked crews you can actually manage',
    kind: 'feature',
    highlights: [
      'Jobs scheduled to a crew now show a link chip ("⛓ 3") on the Dispatch Schedule — tap it to see everyone on the crew.',
      'From there: Unlink someone (their time stays but stops moving with the group), Remove them, or Add a person who inherits the crew\'s times and instructions.',
      'The same management works from the Schedule Dispatch week grid on desktop.',
    ],
  },
  {
    version: 'v2.1370',
    date: '2026-08-03',
    title: 'Bid Board: the estimator stands out',
    kind: 'feature',
    highlights: [
      'The staff column now leads with the estimator in much larger text, with the account manager underneath in smaller grey type.',
      'When the same person is both the estimator and the account manager, their name appears once instead of twice.',
    ],
  },
  {
    version: 'v2.1369',
    date: '2026-08-03',
    title: 'Assign work: tidier times',
    kind: 'fix',
    highlights: [
      'The separate time boxes are gone — the sliding dots set the window and the blue Schedule button shows it.',
      'The Schedule button now reads on two clean lines: who, then when.',
    ],
  },
  {
    version: 'v2.1368',
    date: '2026-08-03',
    title: 'Bid numbers look like bid numbers',
    kind: 'feature',
    highlights: [
      'The Bid Board now shows "b146" instead of a bare "146", so a short number reads as a bid rather than a count.',
    ],
  },
  {
    version: 'v2.1367',
    date: '2026-08-03',
    title: 'Under the hood: coordination for parallel work sessions',
    kind: 'feature',
    highlights: [
      'Development sessions now reserve version numbers through a shared ledger instead of racing each other — fewer renumbered releases and mismatched titles going forward.',
      'No visible app changes.',
    ],
  },
  {
    version: 'v2.1366',
    date: '2026-08-03',
    title: 'Assign work: slide the time',
    kind: 'feature',
    highlights: [
      'The Assign work sheet now has the same two-dot time bar as the other scheduling windows — drag the dots between 6 AM and 8 PM and the times update everywhere, including the Schedule button.',
    ],
  },
  {
    version: 'v2.1365',
    date: '2026-08-03',
    title: 'Bid Board: project name first',
    kind: 'feature',
    highlights: [
      'Each Bid Board row now shows the project name on top with the GC/Builder underneath, so you find a bid by the job you are thinking of.',
    ],
  },
  {
    version: 'v2.1364',
    date: '2026-08-03',
    title: 'People page: no more sideways scroll on phones',
    kind: 'fix',
    highlights: [
      'On the People page, the search box and the "Team leads" / "Manage accounts" buttons were too wide to share one line on a phone, so every page could slide sideways. The buttons now drop to their own line and nothing runs past the edge.',
      'Tablet and desktop are unchanged — the row still fits on one line there.',
    ],
  },
  {
    version: 'v2.1363',
    date: '2026-08-03',
    title: 'Schedule Jobs grid: more days on screen',
    kind: 'fix',
    highlights: [
      'Day headers on the Jobs grid now stack the weekday over the date, so the columns are narrower — a phone shows four days at once instead of two.',
      'The Job column is wider and long job names trim to two lines with an ellipsis instead of stretching the row.',
    ],
  },
  {
    version: 'v2.1362',
    date: '2026-08-03',
    title: 'Bid amounts now say "k"',
    kind: 'fix',
    highlights: [
      'Bid values on the Bid Board read "153k" instead of a bare "153", so it is obvious the number is the bid size — most useful on phone cards, where there is no column header to explain it.',
    ],
  },
  {
    version: 'v2.1361',
    date: '2026-08-03',
    title: 'Schedule Jobs tab: slimmer phone header',
    kind: 'feature',
    highlights: [
      'The Jobs tab matches the Day and People tabs on phones — search tucks behind the magnifier, and the two filter checkboxes live in a View menu.',
    ],
  },
  {
    version: 'v2.1360',
    date: '2026-08-03',
    title: 'Schedule week view: slimmer phone header',
    kind: 'feature',
    highlights: [
      'The week header on phones shrinks to two rows — arrows flank "Week 32 · 08/03–08/07", and tapping the label jumps back to this week.',
      'The four assign tools keep their spots; search now tucks behind a magnifier icon that expands a full-width box, just like the Day view.',
    ],
  },
  {
    version: 'v2.1359',
    date: '2026-08-03',
    title: 'Bid Board: easier to read at a glance',
    kind: 'feature',
    highlights: [
      'Project names are noticeably bigger on both the table and phone cards.',
      'Distance moved out of its own column and into the row dropdown, giving the names more room; the address there still opens Google Maps.',
      'The dropdown drops the account manager (the estimator stays) and the note tabs now sit on the left, with "+ bid note" and "+ customer note" at the bottom of the list where you finish reading.',
      'On phones the "LC" shorthand is now spelled out as "Last contact".',
    ],
  },
  {
    version: 'v2.1357',
    date: '2026-08-03',
    title: 'Tablet header: no more sideways scroll',
    kind: 'fix',
    highlights: [
      'On tablet-width screens the top menu could run past the edge of the screen, letting every page slide sideways. The menu now folds into the ☰ button as soon as it stops fitting.',
      'It used to fold correctly only after you rotated or resized the window — now it sorts itself out on its own, including when the app is opened in a background tab.',
    ],
  },
  {
    version: 'v2.1356',
    date: '2026-08-03',
    title: 'Schedule Day view: slimmer phone header',
    kind: 'feature',
    highlights: [
      'The Day view header on phones shrinks from six rows to two — arrows flank the date, and tapping the date jumps back to Today.',
      'Search tucks behind a magnifier icon (tap to expand), and hiding assistants and estimators is now a one-tap people icon that lights up blue when active.',
      'In Schedule Dispatch, the Dispatch week link lives in the ⋯ menu; on Quickfill it stays right on the row.',
    ],
  },
  {
    version: 'v2.1355',
    date: '2026-08-03',
    title: 'Bid Board: one tidy tools row',
    kind: 'feature',
    highlights: [
      'Customer review moved up next to Archived, on the same line as the search bar — the board starts higher on the page now.',
      'Search, Archived and Customer review stay on one line at every width, including phones.',
    ],
  },
  {
    version: 'v2.1354',
    date: '2026-08-03',
    title: 'Go/no-go checklist moves into the bid form',
    kind: 'feature',
    highlights: [
      'The Bid Board\'s "Checklist" button was really a go/no-go bid evaluation aid — it now lives as a small "Go/no-go" pill beside the New Bid / Edit Bid title, right where you decide whether a job is worth pursuing.',
      'Renamed so it no longer collides with the app-wide Checklist (recurring tasks) feature; the board\'s search row gets a little roomier on phones.',
    ],
  },
  {
    version: 'v2.1353',
    date: '2026-08-03',
    title: 'Bid Board: what do the due-date colors mean?',
    kind: 'feature',
    highlights: [
      'A small red/yellow/grey key now sits beside the Due Date header on the Bid Board — tap it for a plain-English legend: red = past due, yellow = due within 3 days, grey = further out.',
    ],
  },
  {
    version: 'v2.1352',
    date: '2026-08-03',
    title: 'Schedule Day view: readable on phones',
    kind: 'feature',
    highlights: [
      'On phones, each person\'s day is now a clean list — time chips like "8a–11a · 891 · Take 5- Liberty Hill" with a day summary ("6a–6p · 5 stops") — instead of a squeezed timeline with overlapping labels.',
      'Clocked time shows as its own green row (tap it for My Time), travel warnings sit between stops, and people with nothing scheduled collapse to one "Free" line.',
      'Applies to both Schedule → Day and Quickfill\'s Schedule section; tablets and desktops keep the full drag-and-drop timeline.',
    ],
  },
  {
    version: 'v2.1350',
    date: '2026-08-03',
    title: 'Add job to schedule: room to work on phones',
    kind: 'feature',
    highlights: [
      'The Add job to schedule picker now starts at the top of the screen on phones and uses the full height, so you can see far more jobs at once.',
      'When the keyboard opens it shrinks to fit the space above it — and grows right back when the keyboard closes. No more hunting behind the keyboard.',
      'Jobs now list newest first — today\'s jobs at the top instead of being shuffled in with year-old ones — and search results follow the same order.',
    ],
  },
  {
    version: 'v2.1349',
    date: '2026-08-03',
    title: 'Dashboard cards: matching collapse arrows',
    kind: 'fix',
    highlights: [
      'Recent Reports and Assigned Jobs now share the same header style — same small gray collapse arrow, same spacing — instead of two different looks side by side.',
    ],
  },
  {
    version: 'v2.1348',
    date: '2026-08-03',
    title: 'Bid Board: compact Archived button',
    kind: 'fix',
    highlights: [
      'The Archived button on the Bid Board is now an archive-box icon with the count — same button, less space. Hover shows "Archived bids".',
    ],
  },
  {
    version: 'v2.1347',
    date: '2026-08-03',
    title: 'Bid Board rows: click for details, built for phones',
    kind: 'feature',
    highlights: [
      'Click anywhere on a bid row to expand it — GC and project in full, address (opens Google Maps), due date + time, bid value, team, and the notes panel, all in one place.',
      'Due Date and Last Contact now show the weekday + date with a day count: (+4) means 4 days past, (-2) means 2 days away.',
      'The four link columns became one Links cluster showing only what exists; the unread-notes badge, Counts, and Edit now flank the bid number.',
      'On phones, rows become cards — no more sideways scrolling to read a bid.',
    ],
  },
  {
    version: 'v2.1346',
    date: '2026-08-03',
    title: 'Bid Board: jump straight to any section',
    kind: 'feature',
    highlights: [
      'A sticky pill row at the top of the Bid Board — Unsent, Pending, Won, Started, Lost, and Health, each with its live count — takes you straight to that section (and opens it if collapsed).',
      'Estimating Health is finally one tap away instead of a very long scroll.',
      'The two ~100-bid sections (Not yet won or lost, Lost) now show their first 25 rows with a "Show all" button — the page loads and scrolls far lighter. Search and sorting are unchanged.',
    ],
  },
  {
    version: 'v2.1345',
    date: '2026-08-03',
    title: 'Clock buttons look right on phones',
    kind: 'fix',
    highlights: [
      'When clocked in, the timer and Update Focus buttons now stack as two clean full-width rows on phones instead of a lopsided squeezed pair.',
      'The blue button is now labeled "Update Focus" to match the window it opens.',
      'Completed Due Today tasks in My Inbox now read cleanly on phones — full-width title with the completion time underneath, instead of a one-word-per-line squeeze.',
    ],
  },
  {
    version: 'v2.1344',
    date: '2026-08-03',
    title: 'Dispatch Mode Schedule: edit a block right from the agenda',
    kind: 'feature',
    highlights: [
      'On Dispatch Mode → Schedule, tapping the time on a scheduled visit now opens the Edit schedule block modal — change the start, end, or note on the spot.',
      'Tapping the job info still opens Job Detail, exactly as before.',
      'Linked crew blocks move together, and overlaps with anyone\'s existing blocks are caught before saving — same rules as Schedule Dispatch.',
    ],
  },
  {
    version: 'v2.1343',
    date: '2026-08-03',
    title: 'Emails-sent list: tidy rows on phones',
    kind: 'fix',
    highlights: [
      'Long subjects no longer stretch the Settings → Notifications email rows — they trim with an ellipsis (hover for the full subject) and the table scrolls sideways within its own box.',
    ],
  },
  {
    version: 'v2.1342',
    date: '2026-08-03',
    title: 'Under the hood: database type definitions refreshed',
    kind: 'fix',
    highlights: [
      'The app\'s internal database type definitions were re-synced with the live database — no visible changes, just a sturdier foundation for upcoming banking-attribution work.',
    ],
  },
  {
    version: 'v2.1341',
    date: '2026-08-03',
    title: 'Emails-sent list fills itself in',
    kind: 'feature',
    highlights: [
      'The app now records every email it sends the moment it sends it — the Settings → Notifications list no longer depends on pulling from Resend.',
      'Delivery statuses (Delivered, Bounced) still update automatically via the Resend webhook, and Refresh from Resend remains for backfilling history.',
    ],
  },
  {
    version: 'v2.1340',
    date: '2026-08-03',
    title: 'Emails-sent list: fix the Resend connection',
    kind: 'fix',
    highlights: [
      'The "Refresh from Resend" button on Settings → Notifications now uses a dedicated read key, so the list loads instead of erroring.',
    ],
  },
  {
    version: 'v2.1339',
    date: '2026-08-03',
    title: 'Dispatch Inbox: one tap to Gmail',
    kind: 'feature',
    highlights: [
      'The Dispatch Mode Inbox now has an "Open Gmail" link at the top, so checking the email inbox is one tap from the app inbox.',
    ],
  },
  {
    version: 'v2.1338',
    date: '2026-08-03',
    title: 'Settings: Notifications tab now shows emails the app sent',
    kind: 'feature',
    highlights: [
      'The Recent push tab is now called Notifications.',
      'Devs see a new "Most recent emails sent" list at the top — every email the app sends (invoices, estimates, notifications, invites), with delivery status straight from Resend.',
      'A Refresh from Resend button pulls the latest sends on demand; a new webhook keeps statuses like Delivered and Bounced up to date automatically.',
    ],
  },
  {
    version: 'v2.1337',
    date: '2026-08-03',
    title: 'Quickfill: clearer section name, tidier phone header',
    kind: 'fix',
    highlights: [
      'The "Pipeline: customer link & customer pictures" section is now "Missing job info" — it also catches missing billing emails, so the old name undersold it.',
      'On phones, Quickfill now lives in the left hamburger menu for everyone instead of taking up a header icon.',
    ],
  },
  {
    version: 'v2.1336',
    date: '2026-08-03',
    title: 'Count Tool gets a crosshair icon',
    kind: 'fix',
    highlights: [
      'The Count Tool link on the Bid Board (and Submission & Followup) now shows a crosshair target instead of a generic file icon.',
    ],
  },
  {
    version: 'v2.1335',
    date: '2026-08-03',
    title: 'Pin a specific bid, not just the Bids page',
    kind: 'feature',
    highlights: [
      'With a bid open on any Bids tab, the Pin button at the bottom now pins THAT bid — the Dashboard chip reads like "BP352 · pricing" and takes you straight back to it, on any device.',
      'Pin as many bids as you like, even on the same tab; unpin from the same button or Settings when the bid is done.',
      'Devs can "Pin for someone" to drop a teammate directly onto a bid\'s tab.',
    ],
  },
  {
    version: 'v2.1334',
    date: '2026-08-03',
    title: 'One accurate "how it works", not two stale ones',
    kind: 'fix',
    highlights: [
      'The Settings → How it works tab is gone — it had drifted badly from reality (three roles instead of nine, old names, outdated sub permissions).',
      'The "understand how PipeTooling works" guide is now the single, corrected orientation: nine roles, whole-shop framing, Notes for Office, and what subs can actually do today.',
    ],
  },
  {
    version: 'v2.1333',
    date: '2026-08-03',
    title: 'Edit Assembly looks like the rest of the family',
    kind: 'feature',
    highlights: [
      'The Edit Assembly form matches the new Add Part and Add Assembly look: search at the top, compact item rows with P/A chips, and tidy × removes.',
      'Bundle prices are edited by clicking the price itself — type the new number and press Enter. No more Edit/Save/Cancel links.',
    ],
  },
  {
    version: 'v2.1332',
    date: '2026-08-03',
    title: 'Bid Board search fits your phone screen',
    kind: 'fix',
    highlights: [
      'The Bid Board search row no longer pushes the page sideways on a phone — the search box takes the full width with Checklist and Archived wrapping below it.',
      'Bid tables still scroll side-to-side inside their own box, not the page.',
    ],
  },
  {
    version: 'v2.1331',
    date: '2026-08-03',
    title: 'The Bids header works at every screen size',
    kind: 'feature',
    highlights: [
      'Plumbing / Electrical / HVAC are now one compact switch, New Bid stays top-right, and the tab rows scroll sideways instead of wrapping into a mess on smaller screens.',
      'On phones the Bids header is a fraction of its old height, and opening a link to any tab scrolls that tab into view automatically.',
    ],
  },
  {
    version: 'v2.1330',
    date: '2026-08-03',
    title: 'See every email subscription you have',
    kind: 'feature',
    highlights: [
      'Settings → Your account → My email schedule now lists every event-driven email stream in the app — Paid in Full, Payment received, and Estimate accepted — with a clear subscribed or not-subscribed state and where each list is managed.',
      'Estimate-accepted subscriptions on specific estimates show up too, with the estimate names.',
    ],
  },
  {
    version: 'v2.1329',
    date: '2026-08-03',
    title: 'Takeoff quantities: click and type fresh',
    kind: 'feature',
    highlights: [
      'Clicking a Qty box on the Takeoffs sheet clears it so the number pad types a fresh number — no more backspacing the old value first.',
      'Click away without typing and the old quantity stays exactly as it was.',
    ],
  },
  {
    version: 'v2.1328',
    date: '2026-08-03',
    title: 'Add Part pickers: click and just type',
    kind: 'feature',
    highlights: [
      'In the Add Part form, clicking Part Type or a supply house turns the box itself into the search — no separate search field, just click and type.',
    ],
  },
  {
    version: 'v2.1327',
    date: '2026-08-03',
    title: 'Edit Assembly and Add Parts catch up to the new search',
    kind: 'feature',
    highlights: [
      'Edit Assembly now uses the same unified parts-and-assemblies search — picking a result adds it to the assembly instantly, and quantities are edited right in the items list.',
      'Add Parts to an assembly gets a searchable part picker with a create-on-the-spot option when nothing matches; Enter in the quantity field adds the part.',
      'Searchable dropdowns across the app can now offer "add it as new" when your search comes up empty.',
    ],
  },
  {
    version: 'v2.1326',
    date: '2026-08-03',
    title: 'Add Assembly is one search away',
    kind: 'feature',
    highlights: [
      'The Add Assembly form (Takeoffs → Save as Assembly or Add assembly) now has a single search across parts AND assemblies — picking a result adds it instantly, no type dropdown or Add button.',
      'No match? The last row offers to create the part on the spot, and it drops straight into your item list.',
      'Bundle prices got one-line rows with a searchable supply-house picker — Enter adds the price.',
    ],
  },
  {
    version: 'v2.1325',
    date: '2026-08-03',
    title: 'Add Part is now keyboard-fast with searchable pickers',
    kind: 'feature',
    highlights: [
      'Part Type and supply house pickers in the Add Part form are searchable — open, type a few letters, Enter to pick.',
      'Prices are one line each and a blank row is always ready — tab straight through supply house, price, and date to keep adding prices without clicking.',
      'New "Save & add another" button keeps the form open for entering several parts back-to-back — in Takeoffs, Materials, and the assembly modals.',
    ],
  },
  {
    version: 'v2.1324',
    date: '2026-08-03',
    title: 'Bid margin breakdown now shows per-unit prices',
    kind: 'feature',
    highlights: [
      'The "how this margin was computed" popup on Bids → Pricing now shows every line — sale price, materials, tax, labor, cost, and profit — both per unit and extended across the full count.',
      'The margin now stands out in a colored band matching the grid’s green/yellow/red thresholds.',
    ],
  },
  {
    version: 'v2.1323',
    date: '2026-08-03',
    title: 'Weekly billed-report emails, and a truthful email-schedule week',
    kind: 'feature',
    highlights: [
      'Scheduling a Billed Awaiting Payment report can now Repeat weekly \u2014 it re-books itself every week until you cancel the pending send.',
      'My email schedule now also shows emails that already went out this week, dimmed with a checkmark \u2014 Monday afternoon no longer looks like "no emails".',
    ],
  },
  {
    version: 'v2.1322',
    date: '2026-08-03',
    title: 'Click a customer on the Pipeline board to see their full profile',
    kind: 'feature',
    highlights: [
      'The contact-card icon (or the customer\u2019s name) on any Jobs \u2192 Pipeline row opens their profile: contact info you can tap to call or email, open balance with aging, lifetime collected, and how fast they typically pay.',
      'Their jobs, projects, bids, and estimates are right there as clickable pills \u2014 each opens the real thing.',
      'Jobs with an unlinked customer name open the link-or-create flow instead, so you can fix the link on the spot.',
    ],
  },
  {
    version: 'v2.1321',
    date: '2026-08-03',
    title: 'See every email the app sends you',
    kind: 'feature',
    highlights: [
      'Settings \u2192 Your account has a new "My email schedule" section: a week view of every email you\u2019re set to receive \u2014 report digests, scheduled reports, dispatch-day emails \u2014 plus event-driven ones like Paid in Full.',
      'Read-only: it shows what\u2019s configured; changing lists still happens where each email is managed.',
      'Devs get a new Settings \u2192 Email & notifications panel: every recurring email stream in one place \u2014 pause digests, remove recipients, cancel scheduled sends.',
    ],
  },
  {
    version: 'v2.1320',
    date: '2026-08-03',
    title: 'Overhead: maintenance indicators for pending, unpriced, and unassigned time',
    kind: 'feature',
    highlights: [
      'People → Overhead now shows an amber maintenance strip under the three lenses whenever upkeep is skewing the 90-day numbers — it disappears entirely when everything is clean.',
      'Three indicators: sessions still awaiting approval (excluded from the numbers until approved), hours priced at $0 because the person has no wage in Pay config, and salary-schedule time with no job or bid assigned (invisible to overhead).',
      'Each indicator shows counts, hours, and who is affected, explains its exact rule on hover, and says where to fix it. New help guide: "keep the overhead numbers accurate".',
    ],
  },
  {
    version: 'v2.1319',
    date: '2026-08-03',
    title: 'More accurate 90-day overhead rates',
    kind: 'fix',
    highlights: [
      'Stripe test-mode invoices no longer count as revenue in the 90-day overhead rates (People → Overhead and Review) — the overhead-per-revenue numbers read slightly higher and truer.',
      'The 90-day window now always follows the company calendar (Chicago) — viewers in other timezones near midnight no longer see a shifted window.',
      'The Review tab now computes its revenue days through the same shared calculation as the Overhead tab, so the two can’t drift apart.',
    ],
  },
  {
    version: 'v2.1318',
    date: '2026-08-03',
    title: 'Quickfill: label bank transfers and wires',
    kind: 'feature',
    highlights: [
      'New Quickfill section "Bank transfers needing attribution" lists ACH, wire, and check payments that have no label yet — one tap sends each to the office job, payroll, a card bill payment, "not an expense", or a split across jobs.',
      'Shows the last 90 days by default, with a "Show older" button for the backlog, and an Undo for labels applied this session.',
      'Only visible to people granted the labeling capability (and devs). See the new help guide: "label bank transfers and wires".',
    ],
  },
  {
    version: 'v2.1317',
    date: '2026-08-03',
    title: 'Overhead: duplicate-marked bank transactions no longer count as office parts',
    kind: 'fix',
    highlights: [
      'If a Mercury transaction was split to the office job and later marked as a duplicate, its amount kept counting into the 90-day overhead parts pool. It is now excluded.',
      'Applies to both the Overhead tab and the Review tab overhead line.',
    ],
  },
  {
    version: 'v2.1316',
    date: '2026-08-03',
    title: 'Email the Billed Awaiting Payment report to a teammate',
    kind: 'feature',
    highlights: [
      'The Print button on the Billed Awaiting Payment header is now Share / Print: email the report to an office teammate \u2014 right away or scheduled for a time you pick (Central).',
      'In the email, phone numbers and emails are clickable, and clicking any job opens its detail right in PipeTooling. Numbers are built fresh at send time.',
      'Preview it, send yourself a test, or use Print instead \u2014 the old print report is unchanged, one click deeper.',
    ],
  },
  {
    version: 'v2.1315',
    date: '2026-08-03',
    title: 'Behind the scenes: groundwork for emailing the Billed report',
    kind: 'infra',
    highlights: [
      'Database and email plumbing so the office can soon email the Billed Awaiting Payment report to a teammate \u2014 now or scheduled \u2014 with clickable contacts and jobs that open right in the app.',
      'No visible changes yet; the Share button ships next.',
    ],
  },
  {
    version: 'v2.1314',
    date: '2026-08-03',
    title: 'Projects: click anywhere on a row to open its workflow',
    kind: 'feature',
    highlights: [
      'Clicking the empty space of any Projects row now opens that project\u2019s workflow \u2014 no more aiming for the name.',
      'Everything on the row (edit pencil, job/bid/estimate pills, links, superintendent chips) still works exactly as before, and selecting text won\u2019t trigger it.',
    ],
  },
  {
    version: 'v2.1313',
    date: '2026-08-03',
    title: 'Settings: "Unpaid time off" is now "Personal Time Off"',
    kind: 'fix',
    highlights: [
      'The time-off section under Settings \u2192 Your account is now called Personal Time Off.',
      'Nothing else changes \u2014 these days are still unpaid for salaried folks, and the fine print still says so.',
    ],
  },
  {
    version: 'v2.1312',
    date: '2026-08-02',
    title: 'Behind the scenes: Company Scoreboard preview (dev-only)',
    kind: 'infra',
    highlights: [
      'A new dev-only Scoreboard tab on People previews the two-gauge company health view \u2014 profit ratio and office-cost-per-field-dollar \u2014 with sample data while thresholds are calibrated.',
      'No live numbers yet; nothing changes for non-dev roles.',
    ],
  },
  {
    version: 'v2.1311',
    date: '2026-08-02',
    title: 'Cleaner Billed Awaiting Payment header with clickable aging chips',
    kind: 'feature',
    highlights: [
      'The Billed Awaiting Payment header on Jobs \u2192 Pipeline now matches the other sections: a clean one-line title instead of wrapping text.',
      'The 30+/90+ day aging numbers became colored chips \u2014 click one to see only those overdue rows, click again (or "Show all") to clear.',
      'The GC Review, Accounts Receivable, Print, and Paid notifications buttons are now a uniform, quieter row.',
    ],
  },
  {
    version: 'v2.1310',
    date: '2026-08-02',
    title: 'Payment emails: get notified when any payment comes in',
    kind: 'feature',
    highlights: [
      'A new "Paid notifications" gear next to the Billed Awaiting Payment header on Jobs \u2192 Pipeline: pick who gets an email whenever a payment lands on a job \u2014 marked by the office, allocated from a bank deposit, or paid through Stripe.',
      'The email shows payment progress plus the job\u2019s invoices exactly as Edit Job lists them \u2014 each bill\u2019s status, sent date, amount, and what\u2019s still open \u2014 and the line items.',
      'The existing gear across from Paid in Full is now labeled "Paid In Full notifications"; the two lists are separate. When a payment finishes the job, only the Paid in Full email goes out.',
    ],
  },
  {
    version: 'v2.1309',
    date: '2026-08-02',
    title: 'Edit Job: creating a customer from the search box works',
    kind: 'fix',
    highlights: [
      'Typing a new customer\u2019s name into "Link to customer" and finding no match now offers a one-click "+ Create" right in the dropdown, and the Create customer from job button uses the name you typed.',
      'Previously the button stayed grayed out (or used a stale name) because the create flow never saw the search box\u2019s text.',
    ],
  },
  {
    version: 'v2.1308',
    date: '2026-08-02',
    title: 'Behind the scenes: groundwork for bank transfer labeling',
    kind: 'infra',
    highlights: [
      'Database groundwork so specific users can soon be granted the ability to label ACH, wire, and check payments — assigning each to the office, a job, payroll, or "card bill payment".',
      'This will let overhead paid by bank transfer (rent, insurance) finally count in the overhead numbers. No visible changes yet — the queue screens ship next.',
    ],
  },
  {
    version: 'v2.1307',
    date: '2026-08-02',
    title: 'Review tab overhead rates no longer count Internal Transfers',
    kind: 'fix',
    highlights: [
      'The People Review tab’s 90-day overhead rates and Team Summary "Profit (after overhead)" no longer count Internal Transfer bank transactions as office materials — matching the Overhead tab’s rule that transfers between the company’s own accounts are not an expense.',
      'Both tabs now compute the office-materials pool through one shared calculation, so they can’t drift apart again.',
      'The Overhead tab’s numbers are unchanged.',
    ],
  },
  {
    version: 'v2.1306',
    date: '2026-08-02',
    title: 'Behind the scenes: Takeoff assembly editors restructured',
    kind: 'infra',
    highlights: [
      'The three assembly-editing popups on Bids → Takeoffs (Add Assembly, Add Parts, Edit Assembly) moved into their own component.',
      'No visible changes; creating and editing assemblies — including Save as Assembly with a bundle price — works exactly as before.',
    ],
  },
  {
    version: 'v2.1305',
    date: '2026-08-02',
    title: 'Behind the scenes: Team Summary popup restructured',
    kind: 'infra',
    highlights: [
      'The document that powers the People Review tab’s "open in new window" Team Summary moved into its own tested module.',
      'No visible changes; the popup table, sorting, search, and drilldown printouts work exactly as before.',
    ],
  },
  {
    version: 'v2.1304',
    date: '2026-08-02',
    title: 'Behind the scenes: Banking groundwork, part 1',
    kind: 'infra',
    highlights: [
      'The shared Banking transaction table and the Nicknames and Advanced dropdown menus moved into their own component files.',
      'No visible changes; the Ledger and User Sort tabs work exactly as before.',
    ],
  },
  {
    version: 'v2.1303',
    date: '2026-08-02',
    title: 'Behind the scenes: Workflow step form restructured',
    kind: 'infra',
    highlights: [
      'The Add/Edit step popup on the project Workflow page (including its Add Person form) moved into its own component.',
      'No visible changes; adding, editing, and assigning steps works exactly as before.',
    ],
  },
  {
    version: 'v2.1302',
    date: '2026-08-02',
    title: 'Subs: sheets from archived people stop nagging',
    kind: 'fix',
    highlights: [
      'Sub sheets belonging to someone you archived are history, not a problem — when nothing is owed they now collapse into one quiet line instead of filling the warning panel.',
      'If money is still open on an archived person’s sheet, it stays in the panel with an "Archived person" badge so it does not get lost.',
    ],
  },
  {
    version: 'v2.1301',
    date: '2026-08-02',
    title: 'Edit Job: creating a customer now keeps it linked',
    kind: 'fix',
    highlights: [
      'Creating a customer from Edit Job’s "Link to customer" saved the customer but the link quietly vanished moments later — the background autosave was second-guessing the brand-new customer and clearing the field. The link now sticks.',
    ],
  },
  {
    version: 'v2.1300',
    date: '2026-08-02',
    title: 'Behind the scenes: Takeoff price popups restructured',
    kind: 'infra',
    highlights: [
      'The catalog part-prices popup and the assembly bundle-comparison popup on the Bids Takeoff tab moved into their own components.',
      'No visible changes; checking prices and applying bundle quotes works exactly as before.',
    ],
  },
  {
    version: 'v2.1299',
    date: '2026-08-02',
    title: 'Behind the scenes: Takeoff materials summary restructured',
    kind: 'infra',
    highlights: [
      'The materials-by-stage summary and PO review popup on the Bids Takeoff tab moved into their own component.',
      'No visible changes; stage totals, tax, and PO printing work exactly as before.',
    ],
  },
  {
    version: 'v2.1298',
    date: '2026-08-02',
    title: 'Behind the scenes: Takeoff book manager restructured',
    kind: 'infra',
    highlights: [
      'The Takeoff book section (versions, entries, and their edit forms) on the Bids Takeoff tab moved into its own component.',
      'No visible changes; managing takeoff books works exactly as before.',
    ],
  },
  {
    version: 'v2.1297',
    date: '2026-08-02',
    title: 'Behind the scenes: Bids Takeoff groundwork, part 3',
    kind: 'infra',
    highlights: [
      'The draggable part-line row on the Takeoff tab moved into its own component file.',
      'No visible changes; dragging, editing, and pricing part lines works exactly as before.',
    ],
  },
  {
    version: 'v2.1296',
    date: '2026-08-02',
    title: 'Subs: unlinked sheets are now fixable on the spot',
    kind: 'feature',
    highlights: [
      'The wall of text about unattributed sub sheets is now a proper panel at the top of People → Subs — one row per sheet showing the name that failed to match, why, and the open balance, sorted money-first.',
      'Each row has an Assign picker and an Open button that jumps straight to the sheet in Jobs → Sub Labor; when the name is close to one roster person, a one-tap "Link to …" suggestion appears.',
      'The panel disappears entirely once every sheet is linked.',
    ],
  },
  {
    version: 'v2.1295',
    date: '2026-08-02',
    title: 'Behind the scenes: Bids Takeoff groundwork, part 2',
    kind: 'infra',
    highlights: [
      'The rule for combining duplicate parts when building assemblies on the Takeoff tab now lives in one shared, tested routine (it previously existed in four separate copies).',
      'No visible changes; adding parts and assemblies works exactly as before.',
    ],
  },
  {
    version: 'v2.1294',
    date: '2026-08-02',
    title: 'Behind the scenes: Bids Takeoff groundwork',
    kind: 'infra',
    highlights: [
      'Internal restructuring of how the Takeoff tab loads purchase-order line summaries — one shared, tested routine now backs three screens.',
      'No visible changes; everything on the Takeoff tab works exactly as before.',
    ],
  },
  {
    version: 'v2.1293',
    date: '2026-08-02',
    title: 'Behind the scenes: Materials page cleanup complete',
    kind: 'infra',
    highlights: [
      'The PO Builder tab moved into its own component — completing the Materials page restructuring that began earlier today.',
      'All six Materials tabs now live in their own components; nothing visible changed anywhere along the way.',
    ],
  },
  {
    version: 'v2.1292',
    date: '2026-08-02',
    title: 'People: the Teams tab is retired',
    kind: 'feature',
    highlights: [
      'Team leads are now managed in one place — the Team leads button on People → Users. The Teams tab, which showed the same manager, is removed.',
      'Old links to the Teams tab land on the Users tab automatically.',
    ],
  },
  {
    version: 'v2.1291',
    date: '2026-08-02',
    title: 'Team leads: one better manager, everywhere',
    kind: 'feature',
    highlights: [
      'The Team leads manager is now organized by leader — each leader is a card with their members underneath, so "who reports to whom" is one glance.',
      'Adding a member happens right inside the leader’s card; the visibility choice is now a clear Full/Strip toggle instead of a cramped dropdown.',
      'Links to archived people show a "Remove stale link" button, and the same improved manager appears in both the People → Users modal and the Teams tab.',
      'New help guide: manage team leads.',
    ],
  },
  {
    version: 'v2.1290',
    date: '2026-08-02',
    title: 'Behind the scenes: Materials Assembly Book tab restructured',
    kind: 'infra',
    highlights: [
      'The Assembly Book tab on the Materials page moved into its own component on top of the shared assembly engine.',
      'No visible changes; assemblies, the detail panel, and the Add Item flow work exactly as before.',
    ],
  },
  {
    version: 'v2.1289',
    date: '2026-08-02',
    title: 'Team leads: names instead of IDs',
    kind: 'fix',
    highlights: [
      'Rows in the Team leads manager that pointed at archived accounts showed raw IDs — every row now shows the person’s name, with "(archived)" marking stale links so they’re easy to spot and remove.',
    ],
  },
  {
    version: 'v2.1288',
    date: '2026-08-02',
    title: 'Behind the scenes: Materials assembly engine restructured',
    kind: 'infra',
    highlights: [
      'The assembly data engine on the Materials page (templates, selection, filters, cost stats) moved into a shared engine used by both assembly tabs.',
      'No visible changes; assemblies, filters, and cost badges work exactly as before.',
    ],
  },
  {
    version: 'v2.1287',
    date: '2026-08-02',
    title: 'Projects: bids and estimates join the cards',
    kind: 'feature',
    highlights: [
      'Every project card now has Bids and Estimates pills under the Jobs pill — linked items as clickable segments with status dots, plus a "+" that creates one already linked to the project.',
      'Bid dots show outcome (won, lost, in progress); estimate dots show unsent, sent, or accepted.',
      'Existing bids can be linked from the Edit Bid form’s new Project picker, with a one-tap suggestion when the bid’s project name matches; estimate drafts got the same picker.',
      'A new help guide covers linking bids and estimates to a project.',
    ],
  },
  {
    version: 'v2.1286',
    date: '2026-08-02',
    title: 'Behind the scenes: Materials Parts Book tab restructured',
    kind: 'infra',
    highlights: [
      'The Parts Book tab on the Materials page moved into its own component on top of the shared parts catalog.',
      'No visible changes; searching, filtering, Load All mode, and price expansion work exactly as before.',
    ],
  },
  {
    version: 'v2.1285',
    date: '2026-08-02',
    title: 'Overhead: one pool, three lenses',
    kind: 'feature',
    highlights: [
      'The Overhead tab now shows your 90-day overhead rate three ways — per field hour (pricing labor), per revenue dollar (bidding), and per labor dollar (crew burden) — each with a note on when to use it.',
      'The Review tab computes its overhead rates from the exact same code, so the two tabs can never disagree again.',
      'A rename no longer zeroes anyone’s labor dollars, data-load failures now say so instead of showing an empty table, and dollar figures in the breakdown read correctly.',
    ],
  },
  {
    version: 'v2.1284',
    date: '2026-08-02',
    title: 'Team leads moved next to the people roster',
    kind: 'feature',
    highlights: [
      'Team-lead assignments are now managed from People → Users via the new "Team leads" button — pick a leader, add members, and set each member’s dashboard-hours visibility.',
      'The old copy of this manager in Settings → Dashboard is gone; a pointer there tells you where it went.',
      'The People → Teams tab is unchanged for now.',
    ],
  },
  {
    version: 'v2.1283',
    date: '2026-08-02',
    title: 'People Overhead: the numbers are now trustworthy',
    kind: 'fix',
    highlights: [
      'Field materials and 90-day figures no longer silently drop rows on large histories — Overhead % and the KPI cards were overstating overhead.',
      'Invoices sent in the evening now count in the right day for the per-$100-of-revenue figure.',
      'Office and bid labor is now valued at the office wage for people paid a dual rate, matching payroll exactly; internal transfers are excluded from all materials totals consistently.',
      'The Overhead tab now requires payroll access — masters without it previously saw a page of silent zeros.',
    ],
  },
  {
    version: 'v2.1282',
    date: '2026-08-02',
    title: 'Behind the scenes: Materials parts catalog restructured',
    kind: 'infra',
    highlights: [
      'The parts catalog that powers the Materials page (part lists, search, filters, Load All mode) moved into a shared engine.',
      'No visible changes; browsing and searching parts works exactly as before.',
    ],
  },
  {
    version: 'v2.1281',
    date: '2026-08-02',
    title: 'Behind the scenes: Materials Purchase Orders tab restructured',
    kind: 'infra',
    highlights: [
      'The Purchase Orders tab on the Materials page moved into its own component, backed by a shared purchase-order engine.',
      'No visible changes; viewing, finalizing, duplicating, printing, and price-confirming POs all work exactly as before, and search/filter state still survives switching tabs.',
    ],
  },
  {
    version: 'v2.1280',
    date: '2026-08-02',
    title: 'Behind the scenes: Materials price editors restructured',
    kind: 'infra',
    highlights: [
      'The part-price and assembly-bundle-price editors on the Materials page moved into their own components.',
      'No visible changes; editing prices works exactly as before.',
    ],
  },
  {
    version: 'v2.1279',
    date: '2026-08-02',
    title: 'Behind the scenes: Materials PO Generator tab restructured',
    kind: 'infra',
    highlights: [
      'The PO Generator tab on the Materials page now lives in its own component — the first tab extraction of the Materials cleanup.',
      'No visible changes; generating PO numbers and the ledger work exactly as before, and your in-progress form survives switching tabs just like it always did.',
    ],
  },
  {
    version: 'v2.1278',
    date: '2026-08-02',
    title: 'Behind the scenes: bids can now be linked to projects',
    kind: 'infra',
    highlights: [
      'Groundwork for showing bids and estimates on project cards — the visible controls arrive in the next update.',
    ],
  },
  {
    version: 'v2.1277',
    date: '2026-08-02',
    title: 'Behind the scenes: Materials page groundwork, part 3',
    kind: 'infra',
    highlights: [
      'Purchase-order printing, part-price loading, and the supply-house stats header on the Materials page moved into shared, tested routines.',
      'No visible changes; printouts and stats render exactly as before.',
    ],
  },
  {
    version: 'v2.1276',
    date: '2026-08-02',
    title: 'Behind the scenes: Materials page groundwork, part 2',
    kind: 'infra',
    highlights: [
      'The assembly cost roll-up and the part/assembly search filters on the Materials page moved into shared, tested routines.',
      'No visible changes; costs, badges, and search behave exactly as before.',
    ],
  },
  {
    version: 'v2.1275',
    date: '2026-08-02',
    title: 'Behind the scenes: Materials page groundwork',
    kind: 'infra',
    highlights: [
      'Internal restructuring of how the Materials page loads purchase-order line items — one shared, tested routine now backs a dozen screens (PO Builder, Purchase Orders, deep links).',
      'No visible changes; everything on the Materials page works exactly as before.',
    ],
  },
  {
    version: 'v2.1274',
    date: '2026-08-02',
    title: 'Projects: cards put the everyday things first',
    kind: 'feature',
    highlights: [
      'The Jobs control now sits at the top of each card’s right side — the most-used thing gets the prime spot, across from the project’s money line.',
      'Edit moved up next to the project title as a small pencil, where editing-the-thing-itself belongs; superintendents follow below the jobs.',
    ],
  },
  {
    version: 'v2.1273',
    date: '2026-08-02',
    title: 'Projects: cleaner cards with a combined Jobs control',
    kind: 'feature',
    highlights: [
      'Each project card now shows one compact Jobs control: every linked job as a clickable segment with a status dot, plus a built-in "+" to create a job.',
      'Hover a job segment to see its pipeline status; projects with many jobs collapse to "+N more".',
      '"Superintendents: None" no longer appears when there is nothing to show — an "+ Superintendent" button shows only when someone can actually be added.',
      'The Edit link is now a proper button with a pencil icon.',
    ],
  },
  {
    version: 'v2.1272',
    date: '2026-08-02',
    title: 'Projects: the "Master" badge is gone',
    kind: 'feature',
    highlights: [
      'Project cards and the Workflow page no longer show the "Master: …" owner badge — since access became company-wide by role, it repeated the same name everywhere and carried no information.',
      'Ownership itself is unchanged behind the scenes; the Edit Customer form still shows and sets it.',
    ],
  },
  {
    version: 'v2.1271',
    date: '2026-08-02',
    title: 'Behind the scenes: local dev sessions last as long as production ones',
    kind: 'infra',
    highlights: [
      'The local development stack issued 1-hour sign-in tokens while production issues 10-hour ones — local now matches, so session behavior is the same in both.',
    ],
  },
  {
    version: 'v2.1270',
    date: '2026-08-02',
    title: 'Behind the scenes: Bids and People developer docs match the app again',
    kind: 'infra',
    highlights: [
      'Internal docs for Bids, People, Prospects, Quickfill, and Projects now use the current names (Labor tab, Hiring, Payroll, Billed Awaiting Payment) and accurate schemas.',
      'The glossary and main project documentation dropped references to renamed surfaces and long-gone files.',
    ],
  },
  {
    version: 'v2.1269',
    date: '2026-08-02',
    title: 'Behind the scenes: incident and database runbooks no longer contradict each other',
    kind: 'infra',
    highlights: [
      'The troubleshooting guide now routes a frozen-database incident to evidence-first triage instead of restart-first advice, matching the freeze runbook.',
      'The migration guide’s "best practices" section matches how migrations actually ship here (no local database, prod-only, safety blocks required).',
      'The access-control reference caught up on all recent permission changes, including subcontractors’ new own-row visibility into their labor sheets.',
    ],
  },
  {
    version: 'v2.1268',
    date: '2026-08-02',
    title: 'Behind the scenes: Jobs, Banking, and Materials developer docs match the new names',
    kind: 'infra',
    highlights: [
      'Internal architecture docs for Jobs, Estimates, Banking, Materials, and Settings now use the current surface names (Pipeline, Card Review, PO Builder) and accurate file references.',
      'A section describing a Settings component removed back in v2.922 is gone, so nobody goes looking for code that no longer exists.',
    ],
  },
  {
    version: 'v2.1267',
    date: '2026-08-02',
    title: 'Behind the scenes: developer docs refreshed after a full audit',
    kind: 'infra',
    highlights: [
      'The project README and internal planning docs were brought up to date with what actually shipped — stale commands, counts, and finished to-do lists corrected.',
      'The workflow feature guide now documents sub work orders (offers, accept/decline, settlement) and the Skip action.',
      'Two obsolete scratch documents were removed.',
    ],
  },
  {
    version: 'v2.1266',
    date: '2026-08-02',
    title: 'People Review: sub sheets shared by several people now count for everyone on them',
    kind: 'fix',
    highlights: [
      'The Review tab silently skipped any sub sheet assigned to two or more people — those sheets now show up in each person’s Jobs Worked, allocations, and lifetime labor.',
      'The three work-order email templates (offered, accepted, declined) can now be edited in Settings → Email templates.',
    ],
  },
  {
    version: 'v2.1265',
    date: '2026-08-02',
    title: 'Help guides: tidier ordering and current page names',
    kind: 'fix',
    highlights: [
      'The two scheduling guides now sit together in one "Scheduling" section instead of two one-guide sections.',
      'Eleven guides that sorted to the bottom of their section now appear in a sensible order — including "fix the app when it won’t load", which now ranks near the top of Getting Started.',
      'Guides that said "Schedule Dispatch" now say "Schedule", matching the menu, and a dead "bill a customer" guide link now opens the right guide.',
    ],
  },
  {
    version: 'v2.1264',
    date: '2026-08-01',
    title: 'Dispatch Mode: the schedule shows how many jobs each day has',
    kind: 'feature',
    highlights: [
      'The two-week strip at the top of Dispatch Mode \u2192 Schedule now shows the number of jobs under each date instead of a dot \u2014 same job counted once even with multiple visits.',
    ],
  },
  {
    version: 'v2.1263',
    date: '2026-08-01',
    title: 'Behind the scenes: nightly checks follow the Pipeline rename',
    kind: 'fix',
    highlights: [
      'The automated nightly test that watches the Pipeline board was still looking for the old "Stages" name \u2014 updated so the nightly stays green.',
    ],
  },
  {
    version: 'v2.1262',
    date: '2026-08-01',
    title: 'Banking: "User Review" is now "Card Review"',
    kind: 'feature',
    highlights: [
      'The Mercury tab that reviews card spending per person is now Card Review \u2014 no more sharing a name with the Dashboard\u2019s schedule User Review.',
    ],
  },
  {
    version: 'v2.1261',
    date: '2026-08-01',
    title: 'PO Builder redesign: faster to scan, one tap to add',
    kind: 'feature',
    highlights: [
      'The page fits your screen now \u2014 no more scrolling sideways; on phones the columns stack with your drafts on top.',
      'Every assembly card has an "\u2192 Add to PO" button that drops its parts straight into the selected draft.',
      'Drafts are searchable, show "2 of 3 priced" at a glance, and assembly cards show an estimated cost.',
      'Assemblies are now managed in Assembly Book \u2014 PO Builder is for building POs.',
    ],
  },
  {
    version: 'v2.1260',
    date: '2026-08-01',
    title: 'Materials: the PO workbench tab is now "PO Builder"',
    kind: 'feature',
    highlights: [
      'The tab where you pick assemblies and compose draft purchase orders is now called PO Builder \u2014 no more three tabs with "Purchase Orders" in the name.',
      'All links and pins keep working; only the tab label changed.',
    ],
  },
  {
    version: 'v2.1259',
    date: '2026-08-01',
    title: 'Draft Purchase Orders show when they were created',
    kind: 'feature',
    highlights: [
      'Each draft PO card on Assemblies & Purchase Orders now shows its created date at the right end of the bottom line \u2014 hover it for the exact time.',
    ],
  },
  {
    version: 'v2.1258',
    date: '2026-08-01',
    title: 'Assemblies everywhere \u2014 the last "template" leftovers are gone',
    kind: 'feature',
    highlights: [
      'The material kits you build in the Assembly Book are now called assemblies in every remaining spot \u2014 including the Add to PO button and the Takeoff nested-item labels.',
      'The Assemblies & Purchase Orders tab has a matching web address; old pinned links redirect themselves.',
    ],
  },
  {
    version: 'v2.1257',
    date: '2026-08-01',
    title: 'Pay setup now lives on the Payroll tab',
    kind: 'feature',
    highlights: [
      'The People pay config button (wages, office rates, salary flags) moved from Hours to the Payroll tab \u2014 pay setup and pay history are finally in one place.',
      'Nothing else changed: same modal, same fields, same permissions.',
    ],
  },
  {
    version: 'v2.1256',
    date: '2026-08-01',
    title: 'Paste Fill is back on the Add customer form',
    kind: 'feature',
    highlights: [
      'The Add customer modal has a Paste Fill toggle again \u2014 paste a tab-separated Name, Address, Email, Phone, Date line and hit Fill Fields.',
      'Works everywhere the modal opens: the Customers page and both add-customer flows on Bids.',
    ],
  },
  {
    version: 'v2.1255',
    date: '2026-08-01',
    title: 'Pipeline rename: last few stragglers',
    kind: 'fix',
    highlights: [
      'A full walk-through found eight leftover "Stages" labels in links, tooltips, and Dispatch Mode — all now say Pipeline.',
    ],
  },
  {
    version: 'v2.1254',
    date: '2026-08-01',
    title: 'Pay Reports, not pay stubs \u2014 plus Job # column headers',
    kind: 'feature',
    highlights: [
      'Everything that said "pay stub" now says "Pay Report" \u2014 the crew are 1099 contractors, and pay stub read too much like a W-2 paycheck.',
      'Columns showing job numbers are headed "Job #" whether the job uses an HCP or a Click number.',
      'The last few "cost estimate" leftovers on Bids now match the Labor tab\u2019s name.',
    ],
  },
  {
    version: 'v2.1253',
    date: '2026-08-01',
    title: 'Clearer names: Schedule, Hiring, and Paste Fill',
    kind: 'feature',
    highlights: [
      'The nav item for the day-schedule hub now says Schedule (Dispatch Mode and the Dispatch inbox keep their names).',
      'Prospects\u2019 people pipeline is now the Hiring tab \u2014 "Team" was already taken three other places.',
      'The paste-to-autofill box on the new-customer form is now Paste Fill, so it can\u2019t be confused with the Quickfill page.',
    ],
  },
  {
    version: 'v2.1252',
    date: '2026-08-01',
    title: 'Quickfill: sections match the Pipeline wording',
    kind: 'fix',
    highlights: [
      'The "Billing Awaiting Payments" section is now "Billed Awaiting Payment" — the same words as the board section it tracks.',
      '"People Hours (new)" is just "People Hours" — it stopped being new a while ago.',
    ],
  },
  {
    version: 'v2.1251',
    date: '2026-08-01',
    title: 'Jobs & Estimates: the "Stages" boards are now called "Pipeline"',
    kind: 'feature',
    highlights: [
      'The boards track billing status (Waiting, Working, Ready to Bill…), so the tab now says Pipeline — "stages" stays reserved for Rough In / Top Out / Trim Set on Bids.',
      'All links, pins, and bookmarks keep working — only the words changed.',
    ],
  },
  {
    version: 'v2.1250',
    date: '2026-08-01',
    title: 'People Review: negative amounts in Jobs Worked read -$244, not $-244',
    kind: 'fix',
    highlights: [
      'The Jobs Worked list and its per-hour summaries now format negative dollars the standard way everywhere.',
    ],
  },
  {
    version: 'v2.1249',
    date: '2026-08-01',
    title: 'People Review: display cleanup — times, totals, and date windows',
    kind: 'fix',
    highlights: [
      'Times no longer show ":60" seconds (1:20 displayed as 1:19:60 before).',
      'With "Only Count Jobs Marked Paid in Full" on, the Hours total now matches the rows above it, with paid-job hours shown separately.',
      'Negative amounts read -$1,200 instead of $-1,200, and "Last 30/90 days" are now exactly 30/90 days.',
      'Evening invoices and late-day completed tasks no longer fall out of (or into) the wrong day.',
    ],
  },
  {
    version: 'v2.1248',
    date: '2026-08-01',
    title: 'People Review: person panel now matches the Team Summary',
    kind: 'fix',
    highlights: [
      'The per-person panel no longer lists the Office job as a money-losing "job worked" — it is overhead, exactly as the Team Summary already treated it.',
      'Parts cost now includes company-card purchases allocated to jobs, so profit stops reading high on card-heavy jobs.',
      'Jobs tracked by Click number (no HCP number) now resolve properly instead of showing dashes and zero dollars.',
      'Renamed people and names with stray spaces no longer silently drop wages, office hours, tasks, or reports.',
    ],
  },
  {
    version: 'v2.1247',
    date: '2026-08-01',
    title: 'People Review: popup Team Summary now matches the on-page table',
    kind: 'fix',
    highlights: [
      'The "Open in new window" Team Summary used an outdated overhead formula, so its Profit column and ranking disagreed with the table on the page. Both now share one calculation.',
      'The popup gains the Overhead Burden column, and its Profit breakdowns explain the same split-model math as the on-page drilldowns.',
      'Overhead Method B/C were labeled one way in the job rows and the opposite way in the rate breakdown — the letters now agree everywhere.',
    ],
  },
  {
    version: 'v2.1246',
    date: '2026-08-01',
    title: 'People Review: numbers no longer silently truncate as history grows',
    kind: 'fix',
    highlights: [
      'Large data loads now fetch every row instead of silently stopping at 1,000 — previously a person could be credited far too much (or too little) revenue depending on which rows happened to load.',
      'Custom date ranges older than two years now show real hours and correct revenue shares instead of dashes and 100% allocations.',
    ],
  },
  {
    version: 'v2.1245',
    date: '2026-08-01',
    title: 'People Review: load failures now show an error instead of wrong numbers',
    kind: 'fix',
    highlights: [
      'If part of the Review data fails to load, the tab now shows a red error message with a Retry button instead of silently rendering $0 costs and inflated profits.',
      'Switching people quickly no longer risks showing one person’s jobs and hours under another person’s name.',
      'A failed load no longer leaves the panel stuck on "Loading…".',
    ],
  },
  {
    version: 'v2.1244',
    date: '2026-08-01',
    title: 'Pipeline Mobile cards: three jobs per screen instead of one',
    kind: 'feature',
    highlights: [
      'The cryptic j:/b: lines are now labeled chips (job date, bill date, hours), the money summary is one line instead of six, and the side icon rail lies flat along the card footer.',
      'Same information, same taps — each card is about a third of its old height.',
    ],
  },
  {
    version: 'v2.1243',
    date: '2026-08-01',
    title: 'Dispatch schedule: one ⋯ menu for Visible hours, settings, and Share',
    kind: 'feature',
    highlights: [
      'Visible hours moved off the Day row into the ⋯ menu — the item shows your active window, and the ⋯ button glows blue while one is set.',
      'The desktop Dispatch Settings button folded into the same ⋯ menu, so the page tools live in one place on every screen size.',
    ],
  },
  {
    version: 'v2.1242',
    date: '2026-08-01',
    title: 'Dispatch schedule: the new phone layout is now the only one',
    kind: 'feature',
    highlights: [
      'The Old mode / New mode switch is gone — phones always get the compact header with Day first, + Schedule, and the ⋯ menu. Desktop is unchanged.',
    ],
  },
  {
    version: 'v2.1241',
    date: '2026-08-01',
    title: 'Stages: Mobile cards — a phone-first board you can switch on',
    kind: 'feature',
    highlights: [
      'A new Mobile cards toggle in the Stages ⋯ menu turns every section into full-width cards — no more sideways scrolling on a phone.',
      'Each card leads with the job and its stage button, then crew, address, the money bar, and latest activity; tap a card for the message thread and a row of labeled actions.',
      'Works together with Edit mode, remembers your choice per device, and flipping it off brings the classic table straight back.',
    ],
  },
  {
    version: 'v2.1240',
    date: '2026-08-01',
    title: 'Dispatch schedule: a new phone layout — with an Old mode switch',
    kind: 'feature',
    highlights: [
      'On phones the schedule opens on the Day view with a compact header: Day / People / Jobs as a switch, one + Schedule button that names every scheduling flow, and a ⋯ menu for Share and Dispatch settings.',
      'A floating Old mode / New mode pill in the top-right corner flips you back to the classic layout any time — your choice sticks on that device.',
      'Desktop is unchanged.',
    ],
  },
  {
    version: 'v2.1239',
    date: '2026-08-01',
    title: 'Edit Job: a tidy footer on phones',
    kind: 'fix',
    highlights: [
      'The bottom of Edit Job no longer scatters across ragged lines on a phone — the save status sits centered on its own line, with Delete, Undo, and a wide Close in one row beneath it.',
    ],
  },
  {
    version: 'v2.1238',
    date: '2026-08-01',
    title: 'Teams Inbox: tidy one-line section headers on phones',
    kind: 'fix',
    highlights: [
      'The Dispatch and Estimator inbox headers no longer wrap on a phone — the open count is now a small amber chip, and View dismissed becomes a compact archive icon.',
      'Applies to the inbox in Dispatch Mode and the Teams Inbox card on the Dashboard.',
    ],
  },
  {
    version: 'v2.1237',
    date: '2026-08-01',
    title: 'Dispatch Mode: a sharper customer summary with a billed summary',
    kind: 'feature',
    highlights: [
      'The customer’s name is now the title, and their address, email, and phone are one-line tappable rows with icons — map, email, or call in one tap.',
      'A new billed summary shows the money still outstanding across their jobs; expand it to see which jobs carry the balance, with paid-in-full jobs rolled into a count.',
    ],
  },
  {
    version: 'v2.1236',
    date: '2026-08-01',
    title: 'Stages: Edit mode — one tap from any row into Edit Job',
    kind: 'feature',
    highlights: [
      'A new Edit mode toggle in the Stages ⋯ menu (next to Ham mode, for dispatch and controllers) puts a thin EDIT tab on the left edge of every job row.',
      'Tap the tab and that job opens straight in Edit Job — no Job Detail stop in between.',
      'It remembers your choice per browser, and turning it off returns the board to normal.',
    ],
  },
  {
    version: 'v2.1235',
    date: '2026-08-01',
    title: 'Edit Job: Close sits after "All changes saved"',
    kind: 'fix',
    highlights: [
      'The Close button now anchors the bottom-right corner, after the autosave status — read the confirmation, then close.',
    ],
  },
  {
    version: 'v2.1234',
    date: '2026-08-01',
    title: 'Edit Job: the Service type box lines up with HCP and C#',
    kind: 'fix',
    highlights: [
      'The Service type dropdown was taller than the number fields beside it and sat a few pixels lower — all three now share the same height and top edge.',
    ],
  },
  {
    version: 'v2.1233',
    date: '2026-08-01',
    title: 'Edit Job: line item rows stay one line tall on phones',
    kind: 'feature',
    highlights: [
      'Empty line items now show a short "Line item 1" hint instead of wrapping "Specific work or materials" across three lines.',
      'The × and $ boxes start compact and widen automatically as your numbers grow, so the name field keeps the most room.',
      'Tap into the name and it still expands to the full screen width for typing.',
    ],
  },
  {
    version: 'v2.1232',
    date: '2026-08-01',
    title: 'Stages: a cleaner search bar — filters tucked into the ⋯ menu',
    kind: 'feature',
    highlights: [
      'The GC and development dropdowns moved out of the search bar into a Filters group at the top of the ⋯ menu, giving search the full width.',
      'When a filter is on, a blue chip with its name sits in the bar — tap the × to clear it, and the ⋯ button glows blue so an active filter is never invisible.',
    ],
  },
  {
    version: 'v2.1231',
    date: '2026-08-01',
    title: 'Edit Job: the billing math reads as a tidy 2×2 on phones',
    kind: 'feature',
    highlights: [
      'The Paid + Billed + New Invoice → Left to bill chips now split into two even rows on a phone: what is already accounted for on top, the new bill and what remains below.',
      'All four chips share the width evenly, and the invoice amount box stretches with its chip — easier to tap and type.',
    ],
  },
  {
    version: 'v2.1230',
    date: '2026-08-01',
    title: 'Edit Job: less empty space under the invoice slider',
    kind: 'feature',
    highlights: [
      'The draggable billing slider no longer reserves a blank row for the "Job % done" marker when a job has no field progress — the segment list moves up to fill the gap.',
    ],
  },
  {
    version: 'v2.1229',
    date: '2026-08-01',
    title: 'Edit Job: line item names get the full width while you type on phones',
    kind: 'feature',
    highlights: [
      'Tap into a line item name on a phone and the field stretches across the whole screen — the × and $ boxes slide down a row so you can read what you are entering.',
      'Everything snaps back into place when you tap elsewhere.',
    ],
  },
  {
    version: 'v2.1228',
    date: '2026-08-01',
    title: 'Edit Job: cleaner invoice bar header on phones',
    kind: 'feature',
    highlights: [
      'The $0 and job-total labels now sit directly on the ends of the invoice segment bar instead of floating loose above the legend — no more lonely "$0" under the Invoices heading on a phone.',
      'The color legend wraps neatly on its own line.',
    ],
  },
  {
    version: 'v2.1227',
    date: '2026-08-01',
    title: 'Edit Job: HCP, C#, and Service type share one line on phones',
    kind: 'feature',
    highlights: [
      'The top row of Edit Job no longer wraps on a phone — the two number fields slim down so the service type fits beside them.',
      'The trade shortcut pill (PLUM, ELEC, …) now sits next to the Service type label instead of crowding the dropdown.',
    ],
  },
  {
    version: 'v2.1226',
    date: '2026-08-01',
    title: 'A "start here" guide for every role',
    kind: 'feature',
    highlights: [
      'New day-one guides for masters, the office, superintendents, estimators, primaries, and subs \u2014 what your screen is for and what to do first.',
      'The supervisor guides spell out what each role below you can and cannot see, so you can answer "where do I click?" without guessing.',
    ],
  },
  {
    version: 'v2.1225',
    date: '2026-08-01',
    title: 'Fixed: Sub Labor lists went empty for a couple of hours',
    kind: 'fix',
    highlights: [
      'A security-rule loop introduced earlier today made every Sub Labor list (and the related dashboard figures) come back empty. Fixed and verified end to end \u2014 no data was lost or changed.',
    ],
  },
  {
    version: 'v2.1224',
    date: '2026-08-01',
    title: 'Guides are now in Settings \u2014 and you can see what your crew sees',
    kind: 'feature',
    highlights: [
      'Settings \u2192 Guides puts the whole "How do I\u2026" library one tap away for everyone, the same guides as the Help page.',
      'If you supervise people, chips let you flip the list to any role below you \u2014 see exactly which guides a Sub, Helper, or Superintendent gets.',
    ],
  },
  {
    version: 'v2.1223',
    date: '2026-08-01',
    title: 'Edit Job: tighter billing section; segment bills subtract covered money',
    kind: 'feature',
    highlights: [
      'Creating an invoice from selected segments now bills the remaining on those segments — money already paid or invoiced by dollar amount is subtracted automatically instead of blocking the selection.',
      'The billing area is far more compact: the Make Invoice track sits right under the segment strip, the create button sits under the math chips, and the $0-to-total scale rides the legend line.',
      'Line items are single rows — the scope-notes pencil sits inside the name box, the count and price wear their × and $ inside the field, and one Stripe preview beside the ① title shows every line at once.',
      'Payment rows fold their Type / Ref / Memo details into a one-line note (the pencil reopens them); new payments still open ready to fill in.',
    ],
  },
  {
    version: 'v2.1222',
    date: '2026-08-01',
    title: 'Paperwork warnings right where you commit to a sub',
    kind: 'feature',
    highlights: [
      'Picking a sub for a work order shows their compliance at a glance \u2014 including a warning when their COI would lapse before the proposed work window ends.',
      'Assigned steps on the Dashboard now carry a money chip with the work order\u2019s amount and status.',
    ],
  },
  {
    version: 'v2.1221',
    date: '2026-08-01',
    title: 'The Sub Board: see who\u2019s booked when',
    kind: 'feature',
    highlights: [
      'Projects \u2192 Forecast \u2192 Subs shows a lane per sub with their work orders laid out on a timeline \u2014 unanswered offers appear ghosted with a question mark.',
      'Overlapping bookings get a red outline, so you catch a double-booking before it happens.',
      'Click any bar to jump into that project\u2019s workflow.',
    ],
  },
  {
    version: 'v2.1220',
    date: '2026-08-01',
    title: 'Offers to subs carry dates \u2014 and their answers come right back',
    kind: 'feature',
    highlights: [
      'Offering a work order now proposes a work window (pre-filled from the step\u2019s expected dates) and sends the sub a push and email.',
      'The card shows Awaiting answer until they respond; declines come back with the reason and one-click Re-offer.',
      'Withdraw an unanswered offer or Nudge to resend \u2014 and Mark accepted stays for subs who answer by phone.',
    ],
  },
  {
    version: 'v2.1219',
    date: '2026-08-01',
    title: 'Subs can accept or decline work orders from their phone',
    kind: 'feature',
    highlights: [
      'An offered work order shows up as a card on the sub\u2019s Dashboard \u2014 the step, the amount, and the proposed dates, with Accept and Decline buttons.',
      'Declining asks for a quick reason so the office knows what to fix; accepting locks the dates onto the step when none were set.',
      'The office gets a push and email the moment the sub answers.',
    ],
  },
  {
    version: 'v2.1218',
    date: '2026-08-01',
    title: 'Manage developments from Settings',
    kind: 'feature',
    highlights: [
      'Settings → Jobs & dispatch gains a Manage developments block: rename a development (every job follows), set its default GC/Builder, archive finished ones, or delete.',
      'Deleting un-groups the linked jobs — never deletes them — and the confirmation tells you how many.',
      'Archived developments stay on their jobs but drop out of the Edit Job picker.',
    ],
  },
  {
    version: 'v2.1216',
    date: '2026-08-01',
    title: 'Groundwork: work orders can be offered with dates and answered',
    kind: 'infra',
    highlights: [
      'Behind the scenes, a work order can now carry a proposed work window, be declined with a reason, and be answered securely by the sub it belongs to.',
      'Nothing visible changes yet; the sub-side Accept/Decline and the office offer flow arrive in the next updates.',
    ],
  },
  {
    version: 'v2.1215',
    date: '2026-08-01',
    title: 'Cleaner GC + development line on Stages',
    kind: 'fix',
    highlights: [
      'On Jobs → Stages, the dot between the GC and the development is gone — the hard-hat and house icons keep them apart on their own.',
    ],
  },
  {
    version: 'v2.1214',
    date: '2026-08-01',
    title: 'People → Subs: every subcontractor relationship in one place',
    kind: 'feature',
    highlights: [
      'A new Subs tab shows one row per sub: open work orders, balance due, compliance badges (agreement, COI, W-9, license), and their track record.',
      'Click Documents under any sub to classify their paperwork and set expiration dates — badges warn 30 days before anything lapses.',
      'Sheets that can’t be tied to one sub are called out for cleanup instead of miscounting anyone’s balance.',
    ],
  },
  {
    version: 'v2.1213',
    date: '2026-08-01',
    title: 'Groundwork: contract documents know what they are and when they lapse',
    kind: 'infra',
    highlights: [
      'Behind the scenes, a contract document can now be typed (agreement, COI, W-9, license) and carry an expiration date.',
      'Nothing visible changes yet; the Subs page with compliance badges arrives next.',
    ],
  },
  {
    version: 'v2.1212',
    date: '2026-08-01',
    title: 'Subs see what they’re owed, right on their Dashboard',
    kind: 'feature',
    highlights: [
      'Subcontractors get a "Your money" card: total balance owed, each sheet with its open amount, and the full payment and backcharge history.',
      'Offered and accepted work orders show too, so a sub always knows what’s committed and what’s coming.',
      'Same numbers the office sees in Jobs → Sub Labor — one source of truth.',
    ],
  },
  {
    version: 'v2.1211',
    date: '2026-08-01',
    title: 'Groundwork: subs can securely read their own sub sheets',
    kind: 'infra',
    highlights: [
      'Behind the scenes, subcontractor accounts can now read their own sub labor sheets, line items, and payment history — and nothing belonging to anyone else.',
      'Nothing visible changes yet; the "Your money" view on the sub dashboard arrives next.',
    ],
  },
  {
    version: 'v2.1210',
    date: '2026-08-01',
    title: 'Settling a work order creates the Sub Labor sheet automatically',
    kind: 'feature',
    highlights: [
      'Once a step is complete, "Settle → release" on its work order creates the sub’s sheet in Jobs → Sub Labor for the agreed amount (minus any retainage) — no retyping.',
      'A confirmation shows exactly what will be created before anything happens.',
      'Payments and backcharges keep working exactly as they do today, in Sub Labor.',
    ],
  },
  {
    version: 'v2.1209',
    date: '2026-08-01',
    title: 'Sub work orders on workflow steps',
    kind: 'feature',
    highlights: [
      'Every step card can now carry a sub work order — pick the sub, set the agreed amount, then walk it through Offered and Accepted right on the card.',
      'A status rail shows the whole journey (offer through settlement), with the in-progress and complete segments following the step itself.',
      'Balance, paid-to-date, and backcharge figures read live from the linked Sub Labor sheet, and the Projects board money line gains a Committed total.',
    ],
  },
  {
    version: 'v2.1208',
    date: '2026-08-01',
    title: 'Groundwork for pay-per-step sub work orders',
    kind: 'infra',
    highlights: [
      'Behind the scenes: the database can now store a commitment — a sub, a workflow step, and an agreed amount, with offer/accept/approve/settle states.',
      'Nothing visible changes yet; the work-order panel on step cards arrives in the next updates.',
    ],
  },
  {
    version: 'v2.1207',
    date: '2026-08-01',
    title: 'Workflow page shows which subs are on the project',
    kind: 'feature',
    highlights: [
      'A Subs strip in the Workflow header lists every subcontractor assigned to a step, with how many of their steps are still open — hover for the step they are on now.',
    ],
  },
  {
    version: 'v2.1206',
    date: '2026-08-01',
    title: 'Projects rows show Projected and Spent totals',
    kind: 'feature',
    highlights: [
      'Each project row now carries a small money line — Projected (from the workflow projections) and Spent (from step line items) — so owners can scan the board without opening every workflow.',
      'Visible to dev and master accounts only, matching the Workflow page money panel.',
    ],
  },
  {
    version: 'v2.1205',
    date: '2026-08-01',
    title: 'Projects list shows progress bars and what needs attention',
    kind: 'feature',
    highlights: [
      'Each project row now has a step progress bar (hover a segment for the step name), a chip naming the current step, its assignee, and how many days it has been open.',
      'Warning pills call out projects that are waiting on someone, have an unassigned current step, no schedule, or a sent-back step — and those projects sort to the top.',
      'The long text list of step names is retired; the bar carries the same information at a glance.',
    ],
  },
  {
    version: 'v2.1204',
    date: '2026-08-01',
    title: 'Filter and review the board by development',
    kind: 'feature',
    highlights: [
      'Jobs → Stages gains a house-icon development dropdown next to the GC filter — every section and total follows it, and clicking a development name on any row filters right there.',
      'GC Review can now group by development instead: outstanding totals per development, with printable statements.',
    ],
  },
  {
    version: 'v2.1203',
    date: '2026-08-01',
    title: 'Developments: group jobs like a subdivision',
    kind: 'feature',
    highlights: [
      'Edit Job → the Project | Plans | Bid row gains a Development picker — pick a development or create one right there, and the job joins the group.',
      'On Jobs → Stages and Job Detail, the development shows with a house icon next to the GC hard hat.',
      'Search the Stages board by development name to see every job in it.',
    ],
  },
  {
    version: 'v2.1202',
    date: '2026-08-01',
    title: 'Sub Labor sheets can belong to a project',
    kind: 'feature',
    highlights: [
      'A sub labor sheet can now be tied to a project and workflow step — anchored sheets show a project chip in the Sub Labor ledger that jumps straight to the workflow.',
      'Nothing changes for existing sheets; linking happens automatically with the upcoming pay-per-step features.',
    ],
  },
  {
    version: 'v2.1201',
    date: '2026-08-01',
    title: 'Groundwork: step assignments remember the person, not just the name',
    kind: 'infra',
    highlights: [
      'Behind the scenes, assigning someone to a project step now records who they are on the roster, not just their display name — so renaming someone no longer risks disconnecting them from their assigned steps.',
      'Nothing visible changes yet; this powers the upcoming subcontractor features on Projects.',
    ],
  },
  {
    version: 'v2.1200',
    date: '2026-08-01',
    title: 'Step actions from the Dashboard now send the same notifications as the Workflow page',
    kind: 'feature',
    highlights: [
      'Starting, completing, approving, or sending back a project step from the Dashboard card now fires the same emails and pushes as doing it on the Workflow page — including the "Your turn" handoff to the next assignee.',
      'Sending a step back from the Dashboard now reopens the previous step as In Progress (matching the Workflow page) instead of Pending.',
      'Step updates that fail now show an error instead of silently doing nothing.',
    ],
  },
  {
    version: 'v2.1199',
    date: '2026-08-01',
    title: 'Skipping a project step now records it in the step history',
    kind: 'fix',
    highlights: [
      'Skipping a workflow step never wrote a "skipped" entry into the step’s action history — the record silently failed. It now logs like every other action.',
    ],
  },
  {
    version: 'v2.1198',
    date: '2026-07-31',
    title: 'Groundwork for Developments (groups of jobs)',
    kind: 'feature',
    highlights: [
      'Behind the scenes: the database can now store Developments — named groups like a subdivision that many jobs belong to.',
      'Nothing visible changes yet; the Edit Job picker and Stages display arrive in the next updates.',
    ],
  },
  {
    version: 'v2.1197',
    date: '2026-07-31',
    title: 'Balance line under the Forecast timeline',
    kind: 'feature',
    highlights: [
      'Projects → Forecast → Specific (with dates showing) draws the running balance as a line under the day rail — flat where nothing happens, stepping up or down on the day money lands.',
      'Days where the balance is negative get a soft red wash, and a Balance cell in the gutter shows where the line ends.',
      'Line items with a date land on that exact day; undated ones land at the end of their step.',
    ],
  },
  {
    version: 'v2.1196',
    date: '2026-07-31',
    title: 'Money balances on the Forecast timeline',
    kind: 'feature',
    highlights: [
      'Projects → Forecast → Specific now shows a balance column beside each stage — the same running numbers as the Workflow page.',
      'Margin and balance chips sit in the toolbar; the column hides itself for jobs with no money data.',
    ],
  },
  {
    version: 'v2.1195',
    date: '2026-07-31',
    title: 'Running ledger beside the workflow',
    kind: 'feature',
    highlights: [
      'On wide screens, a left rail shows the running balance beside every step and money marker — green when ahead, red when spending outruns the plan.',
      'A small card with the project margin and current balance stays pinned while you scroll.',
    ],
  },
  {
    version: 'v2.1194',
    date: '2026-07-31',
    title: 'See the money flow on a workflow',
    kind: 'feature',
    highlights: [
      'Projections can now attach to a step — before or after it — and show up as $ markers right in the step flow.',
      'Each marker shows running “projected to here” vs “spent” totals, so you can spot where plan and reality diverge.',
      'Every step card gains a Money drawer with its projections, actual line items, and a quick add.',
    ],
  },
  {
    version: 'v2.1193',
    date: '2026-07-31',
    title: 'Job chips open Job Detail right there',
    kind: 'feature',
    highlights: [
      'On Projects rows and the Workflow header, clicking a job now opens the Job Detail window in place instead of jumping to the Jobs page.',
      'The little ▶ notes arrow is gone — Job Detail shows the full notes thread.',
    ],
  },
  {
    version: 'v2.1192',
    date: '2026-07-31',
    title: 'Project superintendent chips are now editable',
    kind: 'fix',
    highlights: [
      'Project rows only show superintendents actually assigned to that project — each chip has an × to remove, and + appears when someone can be added.',
      'Previously, adoption records painted every superintendent onto every project with no way to edit.',
    ],
  },
  {
    version: 'v2.1191',
    date: '2026-07-31',
    title: 'Link bank deposits to payments you already recorded',
    kind: 'feature',
    highlights: [
      'Accounts Receivable allocations now have a “Billed line / Payment received” switch.',
      'Pick “Payment received” to link a deposit to a payment already recorded in Edit Job — no duplicate payment, and the deposit’s remaining drops just the same.',
    ],
  },
  {
    version: 'v2.1190',
    date: '2026-07-31',
    title: 'Clearer names on Projects and Workflow',
    kind: 'feature',
    highlights: [
      'The Projects page’s first tab is now labeled “Projects” (it was “Stages”, which clashed with the Jobs Stages board).',
      'Project workflows now say “step” everywhere — Add step, Hide Old Steps, Assigned Steps — instead of mixing “stage” and “step”.',
      'Jobs → Stages keeps its name.',
    ],
  },
  {
    version: 'v2.1189',
    date: '2026-07-31',
    title: 'Approve moves you to the next stage',
    kind: 'feature',
    highlights: [
      'On the Workflow page, approving a stage now collapses its card, expands the next stage, and scrolls you to it.',
    ],
  },
  {
    version: 'v2.1188',
    date: '2026-07-31',
    title: 'Clearer email-sent line on billed jobs',
    kind: 'feature',
    highlights: [
      'The billed-row hint now reads "Resend · Email sent · [time]" — the Resend button leads, so the action is right where you look.',
    ],
  },
  {
    version: 'v2.1187',
    date: '2026-07-31',
    title: 'A cleaner Stages search bar',
    kind: 'feature',
    highlights: [
      'The search box, # jump, GC filter, and ⋯ tools now sit together in one rounded bar with a search icon.',
      'Focusing the search highlights the whole bar; everything works exactly as before.',
    ],
  },
  {
    version: 'v2.1186',
    date: '2026-07-31',
    title: 'Add your own cities to job-address line breaks',
    kind: 'feature',
    highlights: [
      'Job addresses wrap to a second line at known city names — devs can now add missing cities (like Devine) in Settings → Jobs & dispatch.',
      'The same list also fills the city field correctly in lien and AIA prefills.',
    ],
  },
  {
    version: 'v2.1185',
    date: '2026-07-31',
    title: 'Schedule & time in search got much lighter',
    kind: 'feature',
    highlights: [
      'When “Schedule & time in search” is on, the matching now happens on the server — the same results, a fraction of the data transfer.',
    ],
  },
  {
    version: 'v2.1184',
    date: '2026-07-31',
    title: 'Faster Stages search',
    kind: 'feature',
    highlights: [
      'Stages search now matches job number, name, address, and GC only — making it much lighter and faster.',
      'Searching schedule notes and clock notes is still available: turn on “Schedule & time in search” in the ⋯ menu next to the search box.',
    ],
  },
  {
    version: 'v2.1183',
    date: '2026-07-31',
    title: 'Filter the Stages board by GC',
    kind: 'feature',
    highlights: [
      'A new GC dropdown next to the Stages search shows only that GC\u2019s jobs \u2014 every section and total follows.',
      'Pick \u201cNo GC set\u201d to see the jobs still needing a GC.',
      'The dropdown appears once at least one job has a GC.',
    ],
  },
  {
    version: 'v2.1182',
    date: '2026-07-31',
    title: 'New jobs made from a bid inherit the bid\u2019s GC',
    kind: 'feature',
    highlights: [
      'Creating a job from a bid copies the bid\u2019s GC/Builder onto the job automatically.',
      'Linking a bid to an existing job fills the GC only if the job doesn\u2019t have one yet.',
    ],
  },
  {
    version: 'v2.1181',
    date: '2026-07-31',
    title: 'GC Review: see who owes what, by General Contractor',
    kind: 'feature',
    highlights: [
      'New GC Review button on Jobs \u2192 Stages \u2192 Billed Awaiting Payment groups everything awaiting payment by GC.',
      'Each GC shows their customers, bill-out dates, days outstanding, and total \u2014 with a No-GC bucket so nothing hides.',
      'Print a statement per GC, or Print all for one report.',
    ],
  },
  {
    version: 'v2.1180',
    date: '2026-07-31',
    title: 'Edit Job shows the GC without expanding the Customer section',
    kind: 'feature',
    highlights: [
      'The collapsed Customer header now lists GC/Builder on a second line, with a hard-hat icon.',
    ],
  },
  {
    version: 'v2.1179',
    date: '2026-07-31',
    title: 'Cleaner appointment times on the Stages board',
    kind: 'feature',
    highlights: [
      'Whole-hour times drop the \u201c:00\u201d \u2014 \u201cWed Aug 5 10 AM\u201312 PM\u201d instead of \u201c10:00 AM\u201312:00 PM\u201d.',
    ],
  },
  {
    version: 'v2.1178',
    date: '2026-07-31',
    title: 'See and search jobs by their GC on the Stages board',
    kind: 'feature',
    highlights: [
      'Jobs with a GC/Builder set now show it under the customer name on Jobs \u2192 Stages, marked with a hard-hat icon.',
      'The Stages search matches GC names \u2014 type a GC to see every job under them.',
      'New help guide: track a general contractor on a job.',
    ],
  },
  {
    version: 'v2.1177',
    date: '2026-07-31',
    title: 'Track a General Contractor on each job',
    kind: 'feature',
    highlights: [
      'Edit Job has a new GC/Builder picker under the Customer section \u2014 link any customer as the job\u2019s GC, or clear it any time.',
      'When the job is linked to a bid, one click copies the bid\u2019s GC onto the job.',
      'Job Detail shows the GC under the customer name with a hard-hat icon. The Stages board display ships next.',
    ],
  },
  {
    version: 'v2.1176',
    date: '2026-07-31',
    title: 'Faster People page load for developers',
    kind: 'fix',
    highlights: [
      'The developer-only location indicator on People → Users now asks the database for the short answer instead of downloading every clock-in ever recorded with GPS.',
    ],
  },
  {
    version: 'v2.1175',
    date: '2026-07-31',
    title: 'Groundwork for tracking a GC on each job',
    kind: 'infra',
    highlights: [
      'Jobs can now carry a General Contractor link behind the scenes.',
      'The Edit Job picker and the Stages display for it ship next.',
    ],
  },
  {
    version: 'v2.1174',
    date: '2026-07-31',
    title: 'Create the target bid right from the move-costs window',
    kind: 'feature',
    highlights: [
      'When moving a deleted job’s costs to a bid, the bid search now offers "+ Create new bid" if nothing matches what you typed.',
      'The new bid starts with the job’s customer, address and service type, and is selected as the target immediately.',
    ],
  },
  {
    version: 'v2.1173',
    date: '2026-07-31',
    title: 'Moving a job’s costs onto a bid works now',
    kind: 'fix',
    highlights: [
      'The Edit Job delete flow’s "move costs to a bid" option failed with a database error the moment you picked a target bid.',
      'The preview and the move itself both work now.',
    ],
  },
  {
    version: 'v2.1172',
    date: '2026-07-31',
    title: 'Cover letter follows the Version you have selected',
    kind: 'fix',
    highlights: [
      'On multi-GC bids, the single cover letter could be headed with one GC’s name over another Version’s numbers.',
      'The letter now always follows the active Version chip: switch Versions and the letterhead, amount, and fixtures switch together.',
      'A "· for {GC}" tag appears by the combined document whenever the letter is addressed to someone other than the bid’s own GC.',
    ],
  },
  {
    version: 'v2.1171',
    date: '2026-07-31',
    title: 'RFI, Change Order and Lien Release Google Docs named without underscores',
    kind: 'feature',
    highlights: [
      'The Google Doc copies made from Bids → RFI, Change Order and Lien Release now use spaces in their titles, matching the proposal naming from v2.1170.',
    ],
  },
  {
    version: 'v2.1170',
    date: '2026-07-31',
    title: 'Proposal Google Docs are named without underscores',
    kind: 'feature',
    highlights: [
      'Making a proposal copy from Bids → Cover Letter now titles the Google Doc "ClickProposal 260731 Project Name" instead of "ClickProposal_260731_Project_Name".',
    ],
  },
  {
    version: 'v2.1169',
    date: '2026-07-31',
    title: 'Bid pricing no longer vanishes when you switch versions',
    kind: 'fix',
    highlights: [
      'On Bids \u2192 Pricing, clicking to another Version and back sometimes left the price book empty until you reloaded the page.',
      'It only happened when the two clicks came close together, which is why it seemed random.',
    ],
  },
  {
    version: 'v2.1168',
    date: '2026-07-31',
    title: 'Bid Costs now shows what a bid really cost',
    kind: 'feature',
    highlights: [
      'Bids \u2192 Bid Costs splits its cost column into Labor, Parts, Materials and Total real cost.',
      'Parts and materials moved onto a bid from a job now show up here instead of disappearing.',
      'Gives you an honest number to compare against next time you price similar work.',
    ],
  },
  {
    version: 'v2.1167',
    date: '2026-07-31',
    title: 'Job Detail no longer closes when you use its pop-up windows',
    kind: 'fix',
    highlights: [
      'In Job Detail, clicking anything inside Reports, the job calendar, Schedule, or the paid-job email window closed the whole Job Detail stack instead of doing what you clicked.',
      'Reports → "Add additional report" now opens the Additional Report form. It had looked like a dead button.',
      '"Open in popup" on a report opened from Job Detail now shows the report instead of nothing.',
    ],
  },
  {
    version: 'v2.1166',
    date: '2026-07-31',
    title: 'Put a job’s costs on the bid they belonged to',
    kind: 'feature',
    highlights: [
      'When time and spending land on a job but the work was really bid work, Edit Job → Delete → Reassign now offers "A bid" as the target.',
      'Parts, materials, supply-house splits, card charges, team labor and field reports all move to the bid.',
      'Before you confirm, it shows exactly what moves and what gets deleted with the job — including the job total, which a bid cannot hold.',
      'The bid’s real cost goes up, so next time you price similar work you are comparing against an honest number.',
    ],
  },
  {
    version: 'v2.1165',
    date: '2026-07-31',
    title: 'Groundwork: put a job’s costs on a bid',
    kind: 'feature',
    highlights: [
      'Behind the scenes, bids can now hold parts, materials and supply-house costs the same way jobs do.',
      'Time already clocked to a job can be re-pointed at a bid, along with its field reports.',
      'Nothing changes on screen yet — the button to move a job’s costs onto a bid comes next.',
    ],
  },
  {
    version: 'v2.1164',
    date: '2026-07-31',
    title: 'Nightly smoke tests are green again',
    kind: 'fix',
    highlights: [
      'The automated check that loads the app after every deploy had been failing since v2.1052 — it was still looking for two buttons that had moved, not finding real problems.',
      'The Capable of Being Billed breakdown window now announces its own name to screen readers instead of the Total by Name window’s.',
    ],
  },
  {
    version: 'v2.1163',
    date: '2026-07-31',
    title: 'Builder bid map: see where you win and lose',
    kind: 'feature',
    highlights: [
      'Builder Review cards show won / lost / pending chips and a Bid map button.',
      'The map focuses on that builder \u2014 pins colored green (won), red (lost), yellow (pending) \u2014 with a hit-rate scoreboard banner.',
      'Stage chips still filter in focus mode; \u00d7 returns to the normal map.',
    ],
  },
  {
    version: 'v2.1162',
    date: '2026-07-31',
    title: 'More dark-mode readability fixes',
    kind: 'fix',
    highlights: [
      'Highlighted rows on the crew Jobs table and the banking transaction-context view no longer show unreadable light-on-cream text in dark mode.',
      'The Quickfill schedule-conflicts banner is readable in dark mode.',
      'The Bid Board estimating-health meters dim correctly in dark mode and their position markers stay visible.',
    ],
  },
  {
    version: 'v2.1161',
    date: '2026-07-31',
    title: 'Set prices readable in dark mode',
    kind: 'fix',
    highlights: [
      'On Bids \u2192 Pricing, custom/set Sale Prices now show as amber-on-amber in dark mode instead of white-on-cream.',
    ],
  },
  {
    version: 'v2.1160',
    date: '2026-07-30',
    title: 'Job column header back to the left',
    kind: 'fix',
    highlights: [
      'The Stages \u201cJob\u201d header is left-aligned again, over the job names; Activity stays centered.',
    ],
  },
  {
    version: 'v2.1159',
    date: '2026-07-30',
    title: 'Bid one project to multiple GCs',
    kind: 'feature',
    highlights: [
      'A bid Version can now point at its own GC/Builder \u2014 pick it from the version\u2019s \u270e menu; chips show where each version points.',
      'The Cover Letter page groups included versions by GC and generates one document per GC, each with only their own pricing.',
      'Single-GC bids are untouched \u2014 leave versions on \u201cUse bid default\u201d and everything works exactly as before.',
    ],
  },
  {
    version: 'v2.1158',
    date: '2026-07-30',
    title: 'Crew & Dates header on one line',
    kind: 'fix',
    highlights: [
      'The Stages \u201cCrew & Dates\u201d column header sits on a single line and never wraps.',
    ],
  },
  {
    version: 'v2.1157',
    date: '2026-07-30',
    title: 'Stages column renamed to Crew & Dates',
    kind: 'fix',
    highlights: [
      'The \u201cTeam & Last-update\u201d column header on Stages is now \u201cCrew & Dates\u201d.',
    ],
  },
  {
    version: 'v2.1156',
    date: '2026-07-30',
    title: 'Stages jump button, centered headers, tidier chart tooltip',
    kind: 'feature',
    highlights: [
      'The # number search shows a blue \u23ce button while you type \u2014 click it or press Enter to jump to the job.',
      'Job and Activity column headers center over their columns.',
      'Cost Timeline: the legend is back to one flat line; the hover tooltip now stacks Cost / Paid / Profit / Value created one per line.',
    ],
  },
  {
    version: 'v2.1155',
    date: '2026-07-30',
    title: 'Stages and Cost Timeline polish, five ways',
    kind: 'fix',
    highlights: [
      'Cost Timeline legend items each get their own line.',
      'The Next-appointment date/time line never wraps, and job-name click areas hug the words.',
      'Billed rows drop the redundant \u201cBilled line: $X open\u201d text \u2014 the Reports pill moves there from Activity.',
    ],
  },
  {
    version: 'v2.1154',
    date: '2026-07-30',
    title: 'Last manual bill date retired',
    kind: 'feature',
    highlights: [
      'The manual date field is gone from Edit Job and Job Detail \u2014 billing dates now come entirely from real invoice and payment activity.',
      'Stages b: aging, est. bill dates, lien prefill, and dashboard projections no longer read it either.',
    ],
  },
  {
    version: 'v2.1153',
    date: '2026-07-30',
    title: 'Other-charge button and Cost Timeline legend tidy-ups',
    kind: 'fix',
    highlights: [
      '\u201c+ Add other charge\u201d is now a small link-sized button tucked right under the Other job charges header.',
      'With \u201cValue created\u201d on, the blue legend entry now reads at the end of the line instead of the middle.',
    ],
  },
  {
    version: 'v2.1152',
    date: '2026-07-30',
    title: 'Selecting segments moves the Make Invoice slider',
    kind: 'feature',
    highlights: [
      'Tick stages in \u2461 Invoices and the slider below jumps to the selection\u2019s total \u2014 without locking.',
      'You can still drag, retype, or press New Invoice after; deselecting everything restores the usual suggestion.',
    ],
  },
  {
    version: 'v2.1151',
    date: '2026-07-30',
    title: 'Invoices strip and Cost Timeline polish',
    kind: 'fix',
    highlights: [
      'A single-segment invoice strip now rounds both ends (the right end used to stop hard).',
      'When the yellow field-progress dot meets the slider arrows, the full circle sits neatly between them.',
      'Cost Timeline dollar labels wear a thin background halo so red numbers stay readable in dark mode.',
    ],
  },
  {
    version: 'v2.1150',
    date: '2026-07-30',
    title: 'Line Items fit better on phones',
    kind: 'fix',
    highlights: [
      'The \u00d7 count and $ price columns squeeze tighter to the right, giving the line-item name more room on narrow screens.',
    ],
  },
  {
    version: 'v2.1149',
    date: '2026-07-30',
    title: 'Line Items slims down',
    kind: 'feature',
    highlights: [
      'The column-header band is gone \u2014 count wears a \u00d7 and unit price a $, so rows label themselves.',
      'The helper sentence now lives behind \u201c\u24d8 What are line items?\u201d beside the heading, with the Multiple Segment Generator link right there too.',
    ],
  },
  {
    version: 'v2.1148',
    date: '2026-07-30',
    title: 'Segment labels get a crisp outline',
    kind: 'fix',
    highlights: [
      'White segment names in the \u2461 Invoices strip now carry a thin dark rim, so they stay sharp over the \u201ccovered\u201d stripes.',
    ],
  },
  {
    version: 'v2.1147',
    date: '2026-07-30',
    title: 'Invoices legend is centered',
    kind: 'fix',
    highlights: [
      'The Unbilled / Ready to Bill / Billed / Paid legend now sits centered above the segment strip.',
    ],
  },
  {
    version: 'v2.1146',
    date: '2026-07-30',
    title: 'Invoices section: three tidy-ups',
    kind: 'fix',
    highlights: [
      'The \u201cⓘ How invoices and jobs move\u201d explainer now sits right beside the \u2461 Invoices heading.',
      '\u201cCreate invoice from selected segments\u201d is centered under the strip and reads clearly gray until something is selected.',
      'The 80% / Max / \u2139 shortcut row under the chips is gone \u2014 type, tap a chip, or drag; the slider covers it.',
    ],
  },
  {
    version: 'v2.1145',
    date: '2026-07-30',
    title: 'Make Invoice: the slider badge leads with its percent',
    kind: 'fix',
    highlights: [
      'The badge under the slider handle now reads \u201c25% \u00b7 $30,900\u201d \u2014 percent first, matching the chips above it.',
    ],
  },
  {
    version: 'v2.1144',
    date: '2026-07-30',
    title: 'Edit job: three small billing polish fixes',
    kind: 'fix',
    highlights: [
      'The \u201cJob N% done\u201d marker under the invoice bar now uses the same yellow dot as the bar itself instead of a triangle.',
      'Line items: the Unit price box tucks against the right edge of its column, closing the awkward gap.',
      'The Billing header no longer shows a permanent \u201cSaved\u201d \u2014 you\u2019ll only see \u201cSaving\u2026\u201d while it works, or a failure notice. Silence means saved.',
      'Segment names now read on top of the coverage hatching instead of under it, and the invoice slider\u2019s handle is a matched pair of arrows pinching the bar from above and below.',
    ],
  },
  {
    version: 'v2.1143',
    date: '2026-07-30',
    title: 'Other job charges: the empty row waits to be asked',
    kind: 'fix',
    highlights: [
      'The blank charge row no longer sits there by default \u2014 the section shows just \u201c+ Add other charge\u201d, and clicking it summons a focused row. Removing an unused row tucks it away again.',
    ],
  },
  {
    version: 'v2.1142',
    date: '2026-07-30',
    title: 'Labor and Parts Cost: Other job charges blends in',
    kind: 'fix',
    highlights: [
      'The Other job charges editor lost its bolted-on table: charges are now quiet underline rows that match the neighboring cost sections, with a dashed \u201c+ Add other charge\u201d button \u2014 the same pattern as Line Items. The old \u201cLine Item\u201d column header is gone.',
    ],
  },
  {
    version: 'v2.1141',
    date: '2026-07-30',
    title: 'Make Invoice: the slider triangle points where it acts',
    kind: 'fix',
    highlights: [
      'The green triangle\u2019s point now sits exactly on the edge of the invoice bar it controls \u2014 it used to ride about ten pixels left, so its right side looked like the pointer.',
      'Chip labels now lead with their percent (65% Paid, 0% Billed, 15% Left to bill), and the action button is simply \u201cNew Invoice\u201d.',
      'The ahead-of-field note is centered under the bar, and the long coverage banner above the segment strip is gone \u2014 the hatching, its legend entry, and the chips below already tell that story.',
    ],
  },
  {
    version: 'v2.1140',
    date: '2026-07-30',
    title: 'Make Invoice: the pill lines up with its neighbors',
    kind: 'fix',
    highlights: [
      'The action button (Make new Invoice / Ready to Bill) moved to the pill\u2019s top line with the percent beside it, and the amount sits below \u2014 the same two-level shape as the Paid, Billed, and Left-to-bill chips, so the whole equation reads as one tidy row.',
      'Every chip now shows its percent of the job right on the label (Paid 65%, Billed 0%, Left to bill 10%), the bar no longer repeats the amount inside the blue segment (the badge below carries it), and the ahead-of-field note is down to the plain fact.',
    ],
  },
  {
    version: 'v2.1139',
    date: '2026-07-30',
    title: 'Make Invoice: the button says what it does',
    kind: 'fix',
    highlights: [
      'The New invoice pill slims down again: just the amount, its percent, and one clearly-worded button \u2014 green \u201cMake new Invoice\u201d, flipping to blue \u201cReady to Bill\u201d when the amount equals everything left. The label text is gone; the button carries the words.',
    ],
  },
  {
    version: 'v2.1138',
    date: '2026-07-30',
    title: 'Make Invoice: a slimmer New invoice pill',
    kind: 'fix',
    highlights: [
      'The New invoice chip is now a single-line pill \u2014 label, amount, percent, and the create button side by side \u2014 so the equation row stays low and tidy. The \u201cfull remainder\u201d nuance lives in the blue Ready to Bill button and its tooltip.',
    ],
  },
  {
    version: 'v2.1137',
    date: '2026-07-30',
    title: 'Edit job: the Make Invoice control reads like the math it does',
    kind: 'feature',
    highlights: [
      'The control is now an equation you can touch: Paid + Billed + New invoice \u2192 Left to bill, with the amount box and the create button living right inside the New invoice chip. The chips double as the color legend, so the old legend row is gone.',
      'Billed money moved next to Paid on the left of the bar \u2014 matching every other money bar in the app \u2014 and the drag handle now carries a live \u201c$ \u00b7 %\u201d badge. The yellow field-progress marker stays, now with its own \u201cJob N% done\u201d label.',
      'Percent shortcuts (20\u201380 / Max) are always visible \u2014 no more Quick set menu \u2014 and a quiet note appears when a bill would run well ahead of field progress (fine for deposits and draws; it never blocks).',
    ],
  },
  {
    version: 'v2.1136',
    date: '2026-07-30',
    title: 'Reliability: freeze protection for the database',
    kind: 'infra',
    highlights: [
      'The office-wide \u201cdatabase down\u201d freezes were traced to sessions holding locks while sitting idle in an open transaction \u2014 not crashes, not capacity. The database now kills such sessions after 60 seconds, releasing everything queued behind them.',
      'A freeze runbook now ships in the repo, and Claude Code gains a /db-freeze command that runs live lock forensics before anyone reaches for the restart button.',
    ],
  },
  {
    version: 'v2.1135',
    date: '2026-07-30',
    title: 'Stages: jump to a job by number',
    kind: 'feature',
    highlights: [
      'A small # chip now sits left of the Stages search bar. Click it, type a C# or HCP number, press Enter \u2014 the board opens the right section and scrolls to the job with a highlight flash.',
      'Partial numbers work too (Enter goes to the first match, with a note when several match). Esc or clicking away closes it. The main search bar is unchanged.',
    ],
  },
  {
    version: 'v2.1134',
    date: '2026-07-30',
    title: 'Fix: the auto remainder bill resizes correctly',
    kind: 'fix',
    highlights: [
      'Deleting a draft invoice now re-syncs the job\u2019s auto-maintained remainder bill immediately \u2014 it used to go stale, leaving the numbers looking wrong until someone reopened Bill Customer.',
      'Fixed the resync math itself: it counted the remainder bill against its own total, so a stale remainder could bounce between two wrong amounts instead of correcting. It now always lands on job total minus payments minus the other bills.',
      'The remainder row in the Invoices list now wears a small \u201cauto\u201d tag explaining why it has no delete \u2715, and the Invoices strip no longer counts the elastic remainder as money already billed \u2014 so segment invoicing stays available on Ready to Bill jobs.',
    ],
  },
  {
    version: 'v2.1133',
    date: '2026-07-30',
    title: 'Fix: a segment invoice bills only its own line items',
    kind: 'fix',
    highlights: [
      'An invoice created from selected segments (like a change order) used to render with every line item on the job, each carrying a prorated sliver of the amount. It now lists exactly the lines it was created for, at their real amounts.',
      'Applies to the Stripe bill, its preview, and the physical/PDF invoice alike. Bills made by dollar amount are unchanged.',
    ],
  },
  {
    version: 'v2.1132',
    date: '2026-07-30',
    title: 'Invoices strip: billed money now shows — and can’t be billed twice',
    kind: 'feature',
    highlights: [
      'Bills made by dollar amount (the Make Invoice slider) used to leave the ② Invoices strip looking unbilled. Their money now hatches the strip — first line items first — with a banner totting up what’s already out and what’s left to bill.',
      'A line item fully covered by that money shows a "covered" chip and loses its checkbox until the bill is voided or deleted; partially covered items show how much is spoken for but stay billable.',
      'Creating an invoice from selected segments is now capped at what’s actually left to bill — same math as the Make Invoice slider — so a job can’t be over-billed by combining the two paths.',
    ],
  },
  {
    version: 'v2.1131',
    date: '2026-07-30',
    title: 'Edit job: clearer "Add line item" button',
    kind: 'feature',
    highlights: [
      'The blue (+) that sat on the last line item — making freshly added rows look unconfirmed — is now a dashed "+ Add line item" button in the footer, next to the Job Total.',
      'Every line item now has the same trash icon, including the last one, so any row can be removed directly (the grid always keeps at least one row).',
      'Scope notes and Stripe preview stay exactly where they were, attached to each line.',
    ],
  },
  {
    version: 'v2.1130',
    date: '2026-07-30',
    title: 'Edit job: line-item marks on the % done bar',
    kind: 'feature',
    highlights: [
      'The Billing bar in the Edit job window now shows a small notch where each line item’s share of the job ends — the same boundaries as the Invoices strip — so the yellow field-progress dot reads against the job’s actual scope.',
      'Hover a notch to see which line item ends there and at what percent.',
    ],
  },
  {
    version: 'v2.1129',
    date: '2026-07-30',
    title: 'Recently deleted: see exactly what was deleted',
    kind: 'feature',
    highlights: [
      'Every deletion now has a "What’s inside?" view listing each archived row in plain words — fixture names, payment amounts, dates — with the full raw record one click deeper.',
      'Deletions that removed part of a job or bid now name it ("Under job 878 · Take 5- Seguin") instead of showing a code, and deleted clock sessions say whose session it was.',
      'Filter the list by type, by who deleted, or by searching the labels; technical table names are now in plain English.',
    ],
  },
  {
    version: 'v2.1128',
    date: '2026-07-30',
    title: 'Team Reflect: group feedback by dimension',
    kind: 'feature',
    highlights: [
      'Prospects → Team → Review → Reflect has a new "Group by" toggle: keep the current per-reviewer view, or flip to Dimension to read everyone’s Ability, Drive, and Integrity scores and comments side by side.',
      'Dimension view sorts each list highest score first and shows the team average next to each dimension name.',
    ],
  },
  {
    version: 'v2.1127',
    date: '2026-07-30',
    title: 'Reliability: Unassigned Field Time matches salaried people by identity',
    kind: 'infra',
    highlights: [
      'The Unassigned Field Time queue now recognizes salaried people by identity rather than spelled name — completing today’s series: all hour-and-salary surfaces now match people this way.',
    ],
  },
  {
    version: 'v2.1126',
    date: '2026-07-30',
    title: 'Reliability: the Unassigned Hours view matches salaried people by identity',
    kind: 'infra',
    highlights: [
      'The per-person Unassigned Hours window now recognizes salaried people by identity rather than spelled name when computing effective hours.',
    ],
  },
  {
    version: 'v2.1125',
    date: '2026-07-30',
    title: 'Reliability: Quickfill Hours matches salaried people by identity',
    kind: 'infra',
    highlights: [
      'The Quickfill Hours grid now recognizes salaried people by identity rather than spelled name for display hours and edit permissions.',
    ],
  },
  {
    version: 'v2.1124',
    date: '2026-07-30',
    title: 'Reliability: Crew Jobs matches salaried people by identity',
    kind: 'infra',
    highlights: [
      'The Crew Jobs day view now recognizes salaried people by identity rather than spelled name when computing effective hours.',
    ],
  },
  {
    version: 'v2.1123',
    date: '2026-07-30',
    title: 'Reliability: labor costing matches salaried people by identity',
    kind: 'infra',
    highlights: [
      'Job Summary, Crew P&L, and Team Labor now recognize salaried people by identity rather than spelled name, so renames can no longer skew labor cost math.',
    ],
  },
  {
    version: 'v2.1122',
    date: '2026-07-30',
    title: 'Reliability: salaried status survives renames (first of a series)',
    kind: 'infra',
    highlights: [
      'Salaried-person detection now matches people by their identity, not just their spelled name, so renaming someone can no longer silently drop their salaried status on scheduling surfaces.',
      'No visible change today; this is the first of several screens being moved to identity-based matching.',
    ],
  },
  {
    version: 'v2.1121',
    date: '2026-07-30',
    title: 'Fix: payments recorded while Edit Job is open can no longer be lost',
    kind: 'fix',
    highlights: [
      'If a payment arrives (for example a customer pays a Stripe invoice) while someone has the job open in Edit Job, saving no longer wipes that payment — the form now only touches the rows it created or loaded.',
      'Job activity no longer shows repeated "payment added" entries every time a job with payments is edited.',
    ],
  },
  {
    version: 'v2.1120',
    date: '2026-07-30',
    title: 'Billing accuracy: Edit Job defers paid totals to the database',
    kind: 'infra',
    highlights: [
      'Edit Job now lets the database compute the paid-to-date total from the payment rows instead of writing its own copy — one less way for totals to disagree.',
      'No visible change to editing or saving jobs.',
    ],
  },
  {
    version: 'v2.1119',
    date: '2026-07-30',
    title: 'Billing accuracy: paid-to-date totals now self-maintain',
    kind: 'infra',
    highlights: [
      'A job’s paid-to-date total is now automatically kept in sync with its individual payment records by the database itself — the two can no longer drift apart.',
      'No visible change; every payment path (Mark Paid, bank deposits, Stripe) works exactly as before.',
    ],
  },
  {
    version: 'v2.1118',
    date: '2026-07-30',
    title: 'Billing safety: test/live switch fully locked to devs',
    kind: 'infra',
    highlights: [
      'The last two places that could read the test/live billing switch without checking who you are now respect the developer-only gate.',
      'Server-side, an unspecified billing mode now defaults to live instead of test — completing today’s test/live separation work.',
    ],
  },
  {
    version: 'v2.1117',
    date: '2026-07-30',
    title: 'Billing safety: test billing keeps its own customer records',
    kind: 'infra',
    highlights: [
      'Test-mode billing now uses its own separate Stripe customer records — running a billing test can no longer disturb a customer’s real Stripe link.',
    ],
  },
  {
    version: 'v2.1116',
    date: '2026-07-30',
    title: 'Billing safety: invoice actions always use the right Stripe mode',
    kind: 'infra',
    highlights: [
      'Voiding, sending, viewing, or adjusting an invoice now always talks to Stripe in the mode the invoice was created in — a mixed-up test/live setting can no longer void or orphan the wrong invoice.',
      'If a request explicitly asks for the wrong mode it is refused with a clear error and nothing changes.',
    ],
  },
  {
    version: 'v2.1115',
    date: '2026-07-30',
    title: 'Billing safety: test payments can no longer touch live invoices',
    kind: 'infra',
    highlights: [
      'Stripe payment notifications are now checked against the invoice they belong to — a test-mode event can only update a test invoice, and a live event only a live one.',
      'Credit-note updates from Stripe now sync reliably for live invoices.',
    ],
  },
  {
    version: 'v2.1114',
    date: '2026-07-30',
    title: 'Billing safety: invoices now remember their Stripe mode',
    kind: 'infra',
    highlights: [
      'Each Stripe invoice now records whether it was created in live or test mode, groundwork that will prevent test actions from ever touching live invoices (and vice versa).',
      'No visible change to billing today.',
    ],
  },
  {
    version: 'v2.1113',
    date: '2026-07-30',
    title: 'Fix: changing the person on a pay record relinks it correctly',
    kind: 'fix',
    highlights: [
      'Editing an offset (or any pay record) to a different person now relinks the record to that person behind the scenes — previously the old link could stick around invisibly.',
      'Renames and combines now self-heal these links at the database level, whichever screen they come from.',
    ],
  },
  {
    version: 'v2.1112',
    date: '2026-07-30',
    title: 'Fix: renaming a person updates offsets and reviewed-hours too',
    kind: 'fix',
    highlights: [
      'Renaming someone (in Settings or the People roster) now also updates their offsets (backcharges, damages, credits) and reviewed-hours records — previously those stayed under the old name.',
    ],
  },
  {
    version: 'v2.1111',
    date: '2026-07-30',
    title: 'Fix: Combine people now carries every pay record type',
    kind: 'fix',
    highlights: [
      'Combining a duplicate person into their real entry now also re-links crew bid assignments, pay stub days, hours display order, offsets, and reviewed-hours records to the kept person.',
      'Previously those five record types stayed attached to the archived duplicate behind the scenes; names were already corrected, so nothing visible changes today — this future-proofs the records.',
    ],
  },
  {
    version: 'v2.1110',
    date: '2026-07-30',
    title: 'Security hardening: internal payment functions locked down',
    kind: 'infra',
    highlights: [
      'Two internal database functions used by Stripe payment processing are now callable only by the payment system itself, not by signed-in users.',
      'No visible change — recording payments, marking invoices paid, and the field collect-payment flow all work exactly as before.',
    ],
  },
  {
    version: 'v2.1109',
    date: '2026-07-30',
    title: 'People Hours grid: press Enter to save a cell',
    kind: 'feature',
    highlights: [
      'After typing hours in a grid cell, press Enter to save — the Edit time window opens with your new hours right away, no need to click elsewhere first.',
      'Press Escape to back out of a cell edit without saving anything.',
    ],
  },
  {
    version: 'v2.1108',
    date: '2026-07-30',
    title: 'Fix: dark mode readability on the People Hours grid',
    kind: 'fix',
    highlights: [
      'Days marked Correct now show their hours in a brighter gray in dark mode — still visibly locked, no longer hard to read.',
      'The highlight washes on the grid (missing-job red, pending amber, focus flash, job highlight) now follow the theme instead of staying light-mode colors, so highlighted cells stay readable in dark mode.',
    ],
  },
  {
    version: 'v2.1107',
    date: '2026-07-30',
    title: 'Paid-in-full email: cost & payment timeline',
    kind: 'feature',
    highlights: [
      'The detailed email now ends with a month-by-month timeline like the Cost Timeline in Edit Job: each month shows a bar for the running total (payments in minus costs out) with the charges and payments that moved it listed underneath.',
      'Team labor is grouped by week, busy months fold their smallest charges into one line, and charges without a date get their own group — the bars stay exact either way.',
      'The email’s cost totals and profit now count all six cost streams (supply-house invoices, tally parts, and other job charges included), matching Edit Job.',
    ],
  },
  {
    version: 'v2.1106',
    date: '2026-07-30',
    title: 'Under the hood: groundwork for the email cost timeline',
    kind: 'infra',
    highlights: [
      'No visible changes — database plumbing so the paid-in-full email can show a month-by-month cost and payment timeline like the one in Edit Job.',
    ],
  },
  {
    version: 'v2.1105',
    date: '2026-07-29',
    title: 'Fix: paid-in-full email window sits still while you scroll',
    kind: 'fix',
    highlights: [
      'Scrolling over the paid-in-full email window no longer moves the Jobs page behind it — the page stays put until you close the window.',
      'Scrolling to the end of the email no longer spills over into the page underneath.',
    ],
  },
  {
    version: 'v2.1104',
    date: '2026-07-29',
    title: 'Job Detail: press Escape to close',
    kind: 'feature',
    highlights: [
      'The Job Detail window now closes when you press the Escape key.',
      'When a smaller window is open on top (calendar, schedule, reports, the paid-in-full email), Escape closes that one first — one layer at a time.',
    ],
  },
  {
    version: 'v2.1103',
    date: '2026-07-29',
    title: 'Paid-in-full email: honest banners and line items',
    kind: 'feature',
    highlights: [
      'The email now tells the truth about payment: green "Paid in full" only when the job is fully paid, an amber "$X (Y%) of $Z paid" banner when partially paid, and gray "Not paid" otherwise — so you can send it for any job, at your leisure.',
      'Both versions now list the job’s line items with a chip showing whether each is Paid, Billed, Draft, or Unbilled (amounts in the detailed version only).',
      'Subjects adapt too: "Payment progress — …" for partial jobs instead of claiming paid in full.',
    ],
  },
  {
    version: 'v2.1102',
    date: '2026-07-29',
    title: 'Under the hood: groundwork for smarter paid-in-full emails',
    kind: 'infra',
    highlights: [
      'No visible changes — database plumbing so the paid-in-full email can soon show real payment progress and the job’s line items.',
    ],
  },
  {
    version: 'v2.1101',
    date: '2026-07-29',
    title: 'Paid-in-full email window polish',
    kind: 'fix',
    highlights: [
      'The paid-in-full email window is now much taller — the email preview fills the window instead of a short strip.',
      'The envelope button on Job Detail is slightly smaller so it sits evenly with the calendar and edit buttons.',
    ],
  },
  {
    version: 'v2.1100',
    date: '2026-07-29',
    title: 'Edit Job: press Escape to close',
    kind: 'feature',
    highlights: [
      'The Edit Job window now closes when you press the Escape key — with the same safety as clicking outside it: anything still saving finishes first.',
      'Escape won’t close the job window while a smaller window is open on top of it, so you can’t lose your place by accident.',
    ],
  },
  {
    version: 'v2.1099',
    date: '2026-07-29',
    title: 'Paid-in-full email: see it before you send it',
    kind: 'feature',
    highlights: [
      'The envelope button on Job Detail now opens the actual email, shown right in the window, instead of sending immediately.',
      'Flip between the Detailed and Summary versions, then "Send to me" or "Send to someone…" from the top of the window.',
      'Picking a recipient switches the preview to the version their role receives, so there are no surprises.',
      'The envelope button also matches the size of the calendar and edit buttons next to it.',
    ],
  },
  {
    version: 'v2.1098',
    date: '2026-07-29',
    title: 'Align hours: link unmarked clock sessions in one pass',
    kind: 'feature',
    highlights: [
      'People → Hours has a new "Align hours" button above the Hours grid — it lists every closed session this week that has no job or bid, in one scrollable pass.',
      'Each row shows what the person was scheduled on that day: one click links the session, or split it across multiple scheduled jobs by schedule %.',
      'When nothing was scheduled, their recent jobs and bids appear as quick picks, with search and the day editor a click away.',
      'Aligned rows turn green with an Undo, and the grid refreshes when you close the window.',
    ],
  },
  {
    version: 'v2.1097',
    date: '2026-07-29',
    title: 'Under the hood: groundwork for Align hours',
    kind: 'infra',
    highlights: [
      'No visible changes — internal plumbing for an upcoming People → Hours tool that links unmarked clock sessions to jobs in one pass.',
    ],
  },
  {
    version: 'v2.1095',
    date: '2026-07-29',
    title: 'Fix: adjusting times on an unsaved hours block',
    kind: 'fix',
    highlights: [
      'Adjust times no longer shows an error when the block came from a typed People → Hours value (or a "+"-added block) that hasn’t been saved yet — the new times now apply to the draft and save when you save the editor.',
    ],
  },
  {
    version: 'v2.1094',
    date: '2026-07-29',
    title: 'Under the hood: Edit Job window cleanup — all sections done',
    kind: 'infra',
    highlights: [
      'No visible changes — the Edit Job window’s header row moved into its own component, completing the section-by-section internal cleanup of this window.',
    ],
  },
  {
    version: 'v2.1093',
    date: '2026-07-29',
    title: 'Under the hood: Edit Job customer block cleanup',
    kind: 'infra',
    highlights: [
      'No visible changes — the customer block and the "Create customer from job" window moved into their own components, with the customer display logic now under unit tests.',
    ],
  },
  {
    version: 'v2.1092',
    date: '2026-07-29',
    title: 'Under the hood: Edit Job links section cleanup',
    kind: 'infra',
    highlights: [
      'No visible changes — the Project | Plans | Bid links section of the Edit Job window moved into its own component, with its bid-label logic now under unit tests.',
    ],
  },
  {
    version: 'v2.1091',
    date: '2026-07-29',
    title: 'Under the hood: Edit Job window cleanup continues',
    kind: 'infra',
    highlights: [
      'No visible changes — the job identity fields (HCP, C#, service type, name, address, bill date) moved into their own component as part of the ongoing Edit Job internals cleanup.',
    ],
  },
  {
    version: 'v2.1090',
    date: '2026-07-29',
    title: 'Edit Job: "View contract & acceptance" now opens properly',
    kind: 'fix',
    highlights: [
      'On Edit Job, the source-estimate banner\'s "View contract & acceptance" button used to open the acceptance record hidden behind the form — it now appears on top, as intended.',
      'Internal cleanup of the Edit Job window continues behind the scenes.',
    ],
  },
  {
    version: 'v2.1089',
    date: '2026-07-29',
    title: 'Under the hood: architecture maps for every large code surface',
    kind: 'infra',
    highlights: [
      'No visible changes — 20 new developer documents map the internals of every large screen and window in the app.',
      'These maps make future maintenance and cleanup work faster and safer.',
    ],
  },
  {
    version: 'v2.1088',
    date: '2026-07-29',
    title: 'Takeoffs: jump from a part to the assemblies that include it',
    kind: 'feature',
    highlights: [
      'On Bids → Takeoffs, a selected part line now shows a blue "In N assemblies" link when saved assemblies include that part.',
      'Clicking it opens the Add assembly picker filtered to just those assemblies, each showing how many of the part it uses — expand into part lines or add as a bundle, same as always.',
      'Clear the filter chip to browse all assemblies.',
      'New help guide: "find the assemblies that include a part".',
    ],
  },
  {
    version: 'v2.1087',
    date: '2026-07-29',
    title: 'One click: bill the hazmat fee to the tenant',
    kind: 'feature',
    highlights: [
      "On Edit Job, every hazmat fee's RIDERS row gains \"Bill separately…\" — the fee moves onto its own invoice (the customer's bill shrinks by the same amount) and you're asked who pays it.",
      "Enter the tenant's name and email, then send both bills as usual: the customer's invoice goes to the customer, the fee invoice goes to the tenant.",
      'New help guide: "bill part of a job to someone else".',
    ],
  },
  {
    version: 'v2.1086',
    date: '2026-07-29',
    title: 'Bill an invoice to someone other than the customer',
    kind: 'feature',
    highlights: [
      'On Edit Job → Invoices, every draft invoice gets a "Bill to…" button — enter a different payer (a tenant, a property manager) and that one invoice bills them instead of the job customer.',
      'Overridden invoices wear an amber "→ name" chip, and Bill Customer shows a banner naming the alternate recipient before you send.',
      'Stripe, physical-invoice email, and the hazmat notice all go to the person you chose; the rest of the job still bills the customer.',
      "A fee billed to someone else never rolls back into the customer's bill.",
    ],
  },
  {
    version: 'v2.1085',
    date: '2026-07-29',
    title: 'Groundwork: invoices can reach an alternate payer',
    kind: 'feature',
    highlights: [
      'Behind the scenes: Stripe billing, the physical-invoice email, and the hazmat notice email now know how to send to an invoice’s alternate recipient when one is set.',
      'Billing a different payer never touches the customer’s saved Stripe record.',
      'The editing screens arrive in the next update.',
    ],
  },
  {
    version: 'v2.1084',
    date: '2026-07-29',
    title: 'Groundwork: bill an invoice to someone else',
    kind: 'feature',
    highlights: [
      'Behind the scenes: invoices can now remember an alternate recipient (name, email, phone) — the first step toward billing part of a job to a different payer, like a tenant covering a hazmat fee.',
      'Nothing changes in the app yet; the editing screens arrive in the next updates.',
    ],
  },
  {
    version: 'v2.1083',
    date: '2026-07-29',
    title: 'Smoother database updates during the workday',
    kind: 'fix',
    highlights: [
      'Behind the scenes: database schema updates now give up quickly if the database is busy instead of freezing the app for everyone until they get their turn.',
    ],
  },
  {
    version: 'v2.1082',
    date: '2026-07-29',
    title: 'Missing bid values stand out on Stages',
    kind: 'feature',
    highlights: [
      'On Jobs → Stages, a job with no bid value now shows a red "no bid value" chip instead of grey text.',
      'Click the chip to open that job with the line-items section highlighted — add a line item to set the value.',
    ],
  },
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
      "The examples use your actual job number and segment amounts, in the same green and blue you'll see on the Stages board.",
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
      "The job-segments strip now shows each segment's name right in its colored block (trimmed with … when narrow), and the list below shows one segment per line.",
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
      "New in Edit Job's Line Items: a Multiple Segment Generator link opens a modal where you set a total, name the segments of work, and give each a percentage — the dollar split calculates live and always adds back to your total.",
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
      "Edit Job's Invoices section now opens with a colored strip showing every line item as a block — in your order, sized by its share of the job, colored by whether it's unbilled, ready to bill, billed, or paid.",
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
      "Behind-the-scenes database change that lets a job's line items link to the invoice that bills them. Nothing visible changes yet — the stage-billing tools land in the next updates.",
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
      "Everything else stays blocked: they can only punch their own time, and cannot edit others' sessions, delete sessions, or approve hours.",
    ],
  },
  {
    version: 'v2.1065',
    date: '2026-07-28',
    title: 'Dispatch cards show the job address',
    kind: 'feature',
    highlights: [
      "On Dispatch (People tab), every schedule card now shows the job's address under the job name — always one line, trimmed with … when it's long. Hover for the full address.",
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
      "The Job activity / notes panel now pins the job's Next appointment (date, time, crew, note) above the feed, in both the inline and full-screen views.",
    ],
  },
  {
    version: 'v2.1060',
    date: '2026-07-28',
    title: "Stages shows each job's next appointment",
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
      "The calendar icon at the top of a job's Detail window now opens the Job Calendar (month view + appointments). Week dispatch and Schedule… are inside it, one click away — Schedule… even opens on the day you highlighted.",
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
      "On phones, the full-screen Job activity / notes view was rendering under the app's top bar and bottom tabs, with bits of the board showing through. It now covers everything edge to edge.",
    ],
  },
  {
    version: 'v2.1053',
    date: '2026-07-28',
    title: "Full-screen activity shows which job you're on",
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
      "The Stages board's bid and Left on Job figures now include hazmat fees (existing jobs corrected).",
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
      "Saving a job no longer silently drops rider fees out of the job's revenue.",
    ],
  },
  {
    version: 'v2.1028',
    date: '2026-07-27',
    title: 'Hazmat fees join the main bill',
    kind: 'feature',
    highlights: [
      "Adding a hazmat fee now increases the job's billing line directly — $1,380 + $500 fee reads $1,880 — instead of creating a separate rider bill that looked like a deduction.",
      'When the bill goes out, the fee still shows as its own labeled line item, on Stripe and now on Physical Invoice too, with the notice traveling along.',
      "If the job has no open main bill, the fee falls back to its own ready-to-bill line so it's never lost.",
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
      "Switching between report types (Status, Walk, Note, EOD) no longer erases what you've typed — each type keeps its entries until you save or close.",
      "Saving still submits only the fields of the type you're on.",
    ],
  },
  {
    version: 'v2.1024',
    date: '2026-07-25',
    title: 'Red phone asks Dispatch for a number',
    kind: 'feature',
    highlights: [
      'Job cards with no customer phone now show a red phone — tap it and Dispatch gets a request to add the number, just like the red photos icon.',
      "Tapping again won't double up: if the request is already in, you're told it's on its way.",
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
      "The bulk-deletion alert's Review deletions button now opens Settings with Recently deleted already expanded, loaded, and scrolled into view.",
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
      "Crew P&L now identifies people by their stored id first, so a renamed crew member's history stays on one line instead of splitting by spelling.",
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
      "Same tap-safe flow everywhere: the number opens in a window first, and Log call posts your notes to the job's activity thread across the app.",
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
      "A nightly automated check now loads the main pages at phone size and fails if anything pushes the page sideways or a popup's close button scrolls out of reach — the bug class we fixed by hand all week.",
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
      "Tap the big number to dial, then jot notes about the call; Log call posts them to the job's activity thread everywhere in the app.",
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
      "Anyone without an email address, or without access to the estimate's owner, is skipped automatically.",
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
      "A build check had been silently blocking every site update since v2.965 — today's phone fixes (Stages tables, header, bottom tab bar) actually reach your device with this release.",
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
      "On mid-size screens (small tablets, split-screen, narrow windows) the top navigation no longer spills off the right edge — it now switches to the compact menu the moment it doesn't fit, and switches back when there's room.",
    ],
  },
  {
    version: 'v2.981',
    date: '2026-07-23',
    title: 'Sub equivalent rate defaults to $50',
    kind: 'fix',
    highlights: [
      "Crew P&L's Sub $/hr equivalent rate now defaults to $50 when not set.",
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
      "Sub revenue shares now always come from what they were paid — sheet unit-hours can no longer shrink a sub's credit.",
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
      "A ✉ next to Edit job lets devs and masters send the paid-in-full email for that job to anyone — the recipient's role decides whether they get the detailed or summary version.",
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
    highlights: [
      "The phone PO screen's title now matches the desktop PO Generator it shares numbering with.",
    ],
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
    highlights: [
      'The job picker no longer opens hidden behind the Add Invoice modal.',
    ],
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
    highlights: [
      'The Screen → Interview → Hire tabs are centered on the Team Prospects board.',
    ],
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
    highlights: [
      'Team Prospects is organized into Screen → Interview → Hire sub-tabs.',
    ],
  },
]
