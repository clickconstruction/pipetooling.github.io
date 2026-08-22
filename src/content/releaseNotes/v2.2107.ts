import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2107',
  date: '2026-08-22',
  title: 'Partnerships: automatic job-add threshold',
  kind: 'feature',
  highlights: [
    'The Job review tab can now add jobs for a partner automatically: set a threshold (say 60%), and any job where their share of approved labor hours reaches it is confirmed and made visible on its own.',
    'Auto-added jobs are stamped "auto ≥ 60%" in purple — never with a person\'s name — and each add is logged on the partnership Timeline.',
    'You stay in charge: turning a job off by hand permanently exempts it from the rule, and the editor previews exactly which jobs a threshold would add before you turn it on.',
  ],
}

export default note
