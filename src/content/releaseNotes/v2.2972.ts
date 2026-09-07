import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2972',
  date: '2026-09-06',
  title: 'One company, part 3: nobody picks an owner any more',
  kind: 'feature',
  highlights: [
    'The "Customer Master" picker is gone from Add customer, Edit customer and the customer page; new customers, jobs, estimates, change orders and prospects are all filed under one company owner account.',
    'The job form offers every customer when you link or create one — no more "belongs to a different master" refusals, no more hidden matches.',
    'Settings → Jobs & billing has a single "Company owner account" row (dev) in place of the per-user "Create jobs as" overrides. New guide: "set the company owner account".',
  ],
}

export default note
