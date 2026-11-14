import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7219',
  date: '2026-11-13',
  title: 'Lien desk: By job is a tab of its own, and the papers say what they are',
  kind: 'feature',
  highlights: [
    'The Lien desk has a fourth tab, By job. It is the list that was Timeline. It shows every job with its whole path, the nearest date first.',
    'Under By paper the tabs now read Monthly notices, Lien affidavits and Retainage notices. They were Notices, Affidavits and Retainage.',
    'The top row now reads To do, By date, By paper, By job. To do is the work. The other three are the same jobs sorted three ways.',
    'Every list holds what it held. Old links and printed codes still open the same list. The Dashboard card for a lien’s year to sue now says Open By job.',
  ],
}

export default note
