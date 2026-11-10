import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6868',
  date: '2026-11-10',
  title: 'The page a box label opens reads like the label',
  kind: 'feature',
  highlights: [
    'Scan a cage or box label while signed out and the top of the page now matches the label: the stencil in a box with its code under it.',
    'The last count reads as a verdict, such as Counted 2 days ago, and turns to Due a count once it is 14 days old.',
    'The search is a field on the page, so a part that is not in that cage is one line of typing away. The photo is a band you tap to see whole.',
    'The sign-in press says who it is for and that it is once per phone. A retired label offers Scan another label, and a wrong code offers to type it.',
  ],
}

export default note
