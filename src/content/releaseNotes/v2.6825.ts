import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6825',
  date: '2026-11-09',
  title: 'The in-kind memo refusal clears as you type',
  kind: 'fix',
  highlights: [
    'In the Record a cash or check payment window, pressing Record on an In kind payment with no memo says "Say what was given instead of money". That red line now goes away the moment you start typing the memo, instead of staying until the next press.',
  ],
}

export default note
