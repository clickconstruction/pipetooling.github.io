import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4708',
  date: '2026-10-06',
  title: 'Lien desk: a late notice can still carry the affidavit while its window is open',
  kind: 'feature',
  highlights: [
    'When every § 53.056 notice window on a sub job closed with nothing sent, the lien is no longer called gone while the affidavit\'s own window is still open. The timeline reads Send the Jul notice late, then file the affidavit, with the days left, and the lien row becomes a window that opens when the late notice is mailed.',
    'On the Lien desk, that job\'s affidavit row says Send the notice first instead of Fix the property, and its notice row offers Draft it late. The new notice names the closed months as a late claim, not as information, and the months grid says so.',
    'Once the affidavit window closes too, everything reads as before: the lien is gone, the money is still owed, chase it in Collections.',
    'This is the owner\'s reading of 2026-10-06. Counsel\'s memo of 2026-09-22 read a closed month as information only; that question is back with counsel, and the rules guide says so.',
  ],
}

export default note
