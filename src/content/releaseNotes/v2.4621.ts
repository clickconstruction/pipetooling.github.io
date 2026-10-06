import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4621',
  date: '2026-10-06',
  title: 'Send the run: read any copy before it prints',
  kind: 'feature',
  highlights: [
    'Every copy in the run has a Preview link. It opens that copy over the run, page by page, exactly as the packet prints it: the cover page, the form, the pay codes and the unpaid invoices.',
    'The arrows walk the whole packet in envelope order. Esc closes the preview and leaves the run and its tracking numbers as they were.',
    'The paragraph that explained the packet now sits behind a ? beside the title, so the envelopes come first.',
  ],
}

export default note
