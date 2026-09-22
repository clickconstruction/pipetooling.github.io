import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3696',
  date: '2026-09-21',
  title: 'Bill tab: the stage chooser is two buttons — In order or Any time',
  kind: 'feature',
  highlights: [
    'Under each line item on Edit Job → Bill the chooser now asks one question: does this stage wait its turn? In order (numbered, waits for the one above it, becomes a draw when it passes) or Any time (its own dates, bills when its work is done). The words replace the old Order / Any pills so nothing reads like a purchase order next to a change-order line.',
    'The third "—" (not a stage) button is gone from the Bill tab and from the Multiple Segment Generator. Fees, permits and pass-throughs are any-time lines like everything else: nobody reports progress on them, so they never turn ready on their own — tick them into whichever draw you like, usually the last. A discount row still has no chooser and follows its work.',
    'The one line that had been set to "—" by hand is now Any time; every other line is exactly as it was.',
    'The guide "split a job into stages and bill stage by stage" is rewritten for the two kinds.',
  ],
}

export default note
