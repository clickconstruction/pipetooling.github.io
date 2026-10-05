import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4606',
  date: '2026-10-05',
  title: 'Submittals: What the GC sees shows their page’s own header and list of revisions',
  kind: 'feature',
  highlights: [
    'The What the GC sees window now draws the top of the GC’s page and its list of revisions exactly as the page does.',
    'The list shows the revisions the GC will see once you share, like Rev 4 as current and Rev 2 under it.',
    'A revision that was never shared is not on the GC’s page. The window now says so, like "Rev 3 is not on their page, because it was never shared."',
  ],
}

export default note
