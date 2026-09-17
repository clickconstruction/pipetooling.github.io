import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3540',
  date: '2026-09-16',
  title: 'Lien desk: the cover note shows on the paper when it is ticked',
  kind: 'feature',
  highlights: [
    'The desk pane now shows what goes in the envelope, page by page: the cover note as page 1 while its box is ticked, then the notice. Untick it and the page leaves.',
    'Preview in a new window shows the same two pages, with a page break before the notice when printed.',
    'A note under the last page says the job’s unpaid invoice follows the notice in the packet.',
  ],
}

export default note
