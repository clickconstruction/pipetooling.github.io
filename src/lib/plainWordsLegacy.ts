/**
 * The help guides written before plain words became the convention (v2.4233, 2026-09-30):
 * every guide that existed that day but `build-a-submittal-package` (v2.4229). A guide on
 * this list is not yet held to the rules in `plainWords.ts`.
 *
 * **Never widen this list.** A new guide is held from its first commit. A PR that touches a
 * guide on this list rewrites it by the rules and removes its row — `npm run
 * check:plain-words` fails CI until it does. The list only shrinks; when it is empty,
 * delete it and let `helpGuidePlainWords.test.ts` hold every guide.
 */
export const LEGACY_PLAIN_WORDS_GUIDES: ReadonlySet<string> = new Set([
  'share-a-help-guide',
  'share-a-job-with-a-teammate',
  'share-a-sub-their-portal',
  'share-job-with-supply-house',
  'share-your-attorney-their-portal',
  'show-a-gc-the-stages-you-plan',
  'sign-in-when-my-password-wont-work',
  'sort-card-purchases-to-jobs',
  'sort-the-bank-feed',
  'sort-the-pipeline-by-percent-complete',
  'sort-the-pipeline-by-time-added',
  'split-a-bill-so-a-customer-can-pay-with-multiple-cards',
  'staff-and-discuss-roadmap-tasks',
  'stage-a-takeoff-for-a-schedule-of-values',
  'start-here-as-a-master',
  'start-here-as-a-primary',
  'start-here-as-a-sub',
  'start-here-as-a-superintendent',
  'start-here-in-the-office',
  'sub-labor-outstanding',
  'supervise-a-crew',
  'tally-payroll-marking',
])
