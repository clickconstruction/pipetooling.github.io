import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4377',
  date: '2026-10-01',
  title: 'Pricing: a version’s ★ base is always one of its own prices',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Deleting the price you have open no longer moves the ★. Pricing goes back to the version’s ★ price instead of starring a price from another version.',
    'Pricing, Share and the Send to strip now show the same ★ base as the cover letter. On BP385, Written to Plan’s own price reads ★ again, and the strip says the GC gets 2 prices.',
    'A price that belongs to another version can no longer become this version’s base. Its card shows Another version’s price and offers no buttons.',
  ],
}

export default note
