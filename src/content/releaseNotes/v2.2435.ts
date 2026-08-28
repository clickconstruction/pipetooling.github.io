import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2435',
  date: '2026-08-28',
  title: 'CountTooling bridge, part 2: the wires are live',
  kind: 'feature',
  highlights: [
    'Archiving a person on PipeTooling now retires their CountTooling account too — the offboarding hole is closed. Restoring brings both back.',
    'Minting a digital twin creates its CountTooling seat automatically, and a link button on each twin retries or backfills a missing seat.',
    'Active Accounts (edit mode) gains a “Create CountTooling seat” button for people who need the estimating tool, plus a one-shot backfill that links existing CountTooling accounts by email.',
  ],
}

export default note
