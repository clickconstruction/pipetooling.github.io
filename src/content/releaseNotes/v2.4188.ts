import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4188',
  date: '2026-09-29',
  title: 'Counts: groups and alternates come in from CountTooling',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Import from /Tooling now keeps CountTooling’s groups: a “[Restroom A] WC” row lands as WC in the Restroom A group, so the name matches your books again and the Group column fills in.',
    'A group CountTooling marked as an alternate — the section a customer wants priced with and without — arrives as one on the bid. The import toast says so, an Alternates tile joins the strip, and every row in it wears a small ALT mark.',
    'The Count Sheet gains a By group view beside List and By plan page. Each group’s heading carries its totals and an Alternate switch, so you can mark or unmark an alternate here too.',
    'Under the sheet, the two numbers the customer asked for: Base, and what each alternate adds. Takeoffs, Labor, Pricing and the Cover Letter learn the split in the next releases.',
  ],
}

export default note
