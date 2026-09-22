import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3718',
  date: '2026-09-22',
  title: 'PO codes: the question comes after the code, and any row can take the answer later',
  kind: 'feature',
  highlights: [
    'Materials → PO Generator now shows the new code on a card, like the phone does — and if the box was left blank, the card asks "What did they say they need?" right there. Read them the code, ask, and Write it down while they are still on the line.',
    'Dispatch Mode → PO asks the same question under the big code when nothing was typed first.',
    'A ledger row with nothing written down reads "add what it was for…" on both doors; click it any time later (when the tech texts you the list, say). "change" fixes a claim that was typed wrong.',
    'Copy on the desktop card carries the code, house, job, person and claim in one line, the way the text to the tech does.',
  ],
}

export default note
