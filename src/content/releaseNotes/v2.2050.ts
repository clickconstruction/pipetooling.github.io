import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2050',
  date: '2026-08-21',
  kind: 'feature',
  title: 'Goals strip: numbered zones, less prose',
  highlights: [
    'Each zone of a goal’s stage bar on Checklist → Review now shows its stage number — the same numbers as the Roadmap badges — so you can tell at a glance which stage is green, amber, or still locked.',
    'The "now: …" text line under the bar is gone; the numbered zones and the tap-open stage ledger already tell that story.',
  ],
}

export default note
