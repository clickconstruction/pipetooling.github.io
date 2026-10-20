import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5689',
  date: '2026-10-20',
  title: 'Pricing: the strip says when labor hours follow other counts',
  kind: 'feature',
  roles: ['estimator', 'assistant', 'master_technician', 'dev'],
  highlights: [
    'Labor hours belong to the whole bid and refresh to a version\'s counts only when the Labor tab opens — so on a bid with two versions of different counts, the margin could quietly read against the other version\'s labor.',
    'Now, when the labor rows don\'t match the counts of the version you are pricing, one amber line under the totals says so — our cost and the margin may be off — with Open Labor as the door that refreshes them.',
    'The line uses the Labor tab\'s own sync rules to decide, so it shows exactly when opening Labor would change something, and clears the moment it has.',
  ],
}

export default note
