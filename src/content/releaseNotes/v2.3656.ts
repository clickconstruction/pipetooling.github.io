import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3656',
  date: '2026-09-20',
  title: 'Lien desk in dark mode: the notice on the page is readable, and so are the buttons',
  kind: 'fix',
  highlights: [
    'In dark mode the cover note and the notice showed as near-white text on a white page — only the address block could be read. The paper now prints dark on white in both themes, on the Lien desk and on every other document the app keeps light (estimates, contracts, previews).',
    'Approve, The leader said to send it, Send to the leader, the Notices / Affidavits switch and Use had white labels on a pale fill in dark mode. They now keep the same solid blue, green and amber they have in light mode.',
    'The grey “mail elsewhere” chip is a step darker so it reads on its background.',
  ],
}

export default note
