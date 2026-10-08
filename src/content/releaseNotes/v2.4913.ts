import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4913',
  date: '2026-10-08',
  title: 'GC Review: the checks sheet opens as a PDF',
  kind: 'feature',
  highlights: [
    'Print the sheet in Find a check now opens the checks sheet as a PDF in a new tab, ready to print or save.',
    'The printout no longer carries the browser’s “about:blank” line at the foot of each page. Each page shows its page number instead.',
    'The PDF is the copy kept in Documents.',
  ],
}

export default note
