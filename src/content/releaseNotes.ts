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
