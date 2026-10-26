import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5872',
  date: '2026-10-26',
  title: 'The Bridge: "moved" needs the pile to fall, the sheet names its stage, and a fairer loss note',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'The scorecard calls a week "moved" only when the link\'s pile fell along with its weeks — weeks also fall when a strong week rolls into the window. The then → now line shows the pile beside the weeks.',
    'The Monday sheet\'s weakest-link readings each carry the stage\'s name, so "the pile / the link / the money" read right in the mail without the dial beside them.',
    'The profit panel\'s loss note no longer blames approvals alone: part of a negative day is hours waiting, part can be materials bought ahead of the work, and the note names the materials share.',
  ],
}

export default note
