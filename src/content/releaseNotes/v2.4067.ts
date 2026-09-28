import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4067',
  date: '2026-09-28',
  title: 'Submittals: where this submittal is, and a walkthrough of every stage',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A strip under the bid name shows the seven stages as pills — schedule & picks, Build Rev 1, reasons & sheets, package, share, their call, resubmit — lit by the revision’s state, with the next thing to do and the button that does it.',
    'Walk me through it (or the ? beside the bid name) runs a walkthrough of every stage in order. A stage whose controls are not on the page yet still gets its stop, so a fresh bid shows the whole road.',
    'The first time a device opens Submittals, the strip offers the walkthrough in a line. Not now puts it away for good on that device.',
    'Tap a pill and the page scrolls to that stage’s controls and rings them.',
  ],
}

export default note
