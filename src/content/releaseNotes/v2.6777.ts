import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6777',
  date: '2026-11-09',
  title: 'The Lien desk is a page: /lien-desk',
  kind: 'feature',
  highlights: [
    'The Lien desk has an address of its own, /lien-desk. The tab you are on, the notice open under Notices and the pile you narrowed to are in the address, so a reload keeps your place and the address bar is the link to paste to a teammate.',
    'Press ← Pipeline at the top left, or the browser’s Back, to return to the Pipeline. The desk has no ✕ and no full-screen button on the page: it is the whole screen.',
    'Every old link still works: a Dashboard card, a forecast door or a bookmark that opened the desk over the Pipeline lands on the page, on the same tab, job and pile.',
    'The gavel, the ☰ menu and the other doors on the Pipeline still open the desk as a window for now. They move to the page in the next release.',
  ],
}

export default note
