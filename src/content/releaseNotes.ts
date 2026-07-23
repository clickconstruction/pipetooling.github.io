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
