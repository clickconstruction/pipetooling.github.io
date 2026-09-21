import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3681',
  date: '2026-09-21',
  title: 'Lien desk: a missed month says what is lost and what is not, and the affidavit shows which months it covers',
  kind: 'feature',
  highlights: [
    'Open a missed month under Earlier months and the record now reads in two lines: Lien — gone for that month’s work; Money — still owed, and on this notice, because the notice claims the whole balance. It used to read as if the dollars were gone.',
    'The record also says when the window closed and whether anything was recorded, and carries the Note it as missed button while nobody has written it down.',
    'On the Affidavits side, each job’s pane has a Months the affidavit claims card: every work month marked on the lien, window open, or — under Worked, not noticed — unsecured, with the reason. A month whose notice was missed is named and left off the lien, never moved to another month; its share of the balance is chased in Collections.',
  ],
}

export default note
