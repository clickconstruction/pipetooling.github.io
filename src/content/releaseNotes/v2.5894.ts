import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5894',
  date: '2026-10-26',
  title: 'The Legal desk is a page: /legal-desk',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Legal desk has an address of its own, /legal-desk. The account, the tab and the view are in it, so a reload keeps your place and the address bar is the link to paste to a teammate.',
    'Every old link still works. /jobs?tab=stages&legal=1 and the Dashboard\'s law firm line land on the page. Back, and the ← Pipeline door at the top left, return you to the Pipeline.',
    'The page is the whole screen, so it has no full screen button and no ✕. It loads only the Collections rows and the legal tables, where the window waited for the whole Pipeline first.',
    'The Pipeline\'s own doors, the scales, the ☰ menu row and the Collections header\'s ⚖ Legal, still open the desk as a window for now. They become links to the page in the next release, and the window frame goes after that.',
  ],
}

export default note
