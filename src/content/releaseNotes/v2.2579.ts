import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2579',
  date: '2026-09-01',
  title: 'Lien releases straight from the job card',
  kind: 'feature',
  highlights: [
    'A new release-of-lien button on Ready to Bill, Billed, and Collections rows generates a Conditional Waiver and Release on Progress Payment — or the unconditional progress / final variants — prefilled from the job.',
    'Owner, amount, project, and dates fill in automatically from the job’s bill lines, saved property owner, and company settings; every field stays editable with a live document preview.',
    'Send it however the GC wants it: copy for email (keeps formatting), print, or download as a PDF.',
  ],
}

export default note
