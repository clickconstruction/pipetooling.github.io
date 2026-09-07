import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2962',
  date: '2026-09-06',
  title: 'Crew Jobs / Bids: the + now puts the job on the clock session',
  kind: 'feature',
  highlights: [
    'On Jobs → Team Labor and Quickfill, pressing + beside a person and picking a job or bid now links that day\'s unlinked clock sessions to it. The day\'s split is computed from the clock, the same way an approval does it, so it can never be overwritten later.',
    'The button says what it will do — "Link 1 session (0.72 h)" — and a person with no approved clock session that day shows "No clock session" instead of a +: there is no split without a clock session.',
    'Need two jobs on one day? "Split day…" opens the person\'s day editor, where you split a session and give each piece its own job.',
    'Old hand-entered splits without a clock behind them show a "manual · no clock" tag and can be cleared.',
  ],
}

export default note
