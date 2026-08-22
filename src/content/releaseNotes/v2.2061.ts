import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2061',
  date: '2026-08-21',
  title: 'Preview a GC statement before sending',
  kind: 'feature',
  highlights: [
    "GC Review's Email… dialog gets a Preview button — the statement opens in a new window exactly as the GC will see it, subject line included, before anything sends.",
    'Edits to the subject show up in the preview; nothing is emailed or logged until you hit Send statement.',
  ],
}

export default note
