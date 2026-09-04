import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2758',
  date: '2026-09-04',
  title: 'Settings → What customers see',
  kind: 'feature',
  highlights: [
    'A new dev-only Settings tab shows every email and page a customer or general contractor gets, rendered live with sample data, in the order they meet them.',
    'Tap any step to see it large at phone or desktop width; emails are built by the same code that sends them, and pages open with a sample token that saves nothing.',
    'Change a setting — estimate copy, public terms, the footer, bid cover-letter defaults — and press Refresh all to see every surface follow.',
    'The customer portal, GC portal view, sub portal and contract page join the view in the next release.',
  ],
}

export default note
