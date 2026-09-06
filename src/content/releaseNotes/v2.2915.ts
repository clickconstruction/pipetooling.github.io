import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2915',
  date: '2026-09-05',
  title: 'People → Hours says who is still on the clock, shows one roster to every role, and its chips say what a click does',
  kind: 'fix',
  highlights: [
    'A day column on the Hours grid now shows "+N on the clock" under its date while people are clocked in — the grid counts finished sessions only, so mid-day it no longer looks like the crew worked a fraction of what the clock strip above shows.',
    'Assistants and owners see the same Hours roster: archived helpers no longer appear as zero-hour rows on an assistant\'s grid.',
    'The amber pending chip on a grid cell now says "click to review" — it opens the session popover, and the Approve button lives there.',
    'People → Feedback adds a "skipped last deal" count next to due / rated / words, so a deck that is On but quiet explains itself.',
  ],
}

export default note
