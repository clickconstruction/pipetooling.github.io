import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2966',
  date: '2026-09-06',
  title: 'No split without a clock session — now on People → Hours too',
  kind: 'feature',
  highlights: [
    'The rule from the Crew Jobs / Bids table now covers the two People → Hours editors: the "Assign … to jobs or bids" window and the day audit. A job pick goes on the day\'s clock sessions and the split follows; the percent boxes and Save / Accept buttons are gone.',
    'In the assign window, Common Jobs, Recent jobs & bids and the search all link the day\'s sessions in one tap. Days with hours but no clock session are listed as skipped — there is nothing to put a job on until a session is approved.',
    'In the day audit, Edit shows "Link N sessions (H h)" for unlinked sessions, next to the per-session Assign control and Re-sync from clock that were already there. Pending sessions carry the link into approval, and the toast says so.',
    'Old hand-entered splits with no clock behind them show "manual · no clock" and can be cleared. "Split day…" opens the day editor when one person worked two jobs.',
  ],
}

export default note
