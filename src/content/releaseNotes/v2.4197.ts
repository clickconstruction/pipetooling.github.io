import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4197',
  date: '2026-09-30',
  title: 'The bid room offers the alternate as an add-on',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A bid’s signable link now shows each alternate as an add-on the customer can tick beside the option they choose — ticked to start, with what it covers and what it adds. The total and the Approve button follow the ticks.',
    'Signing records the answer on the bid: the alternates they took, the agreed value, and a green “alt taken” on the Bid Board — the same as marking it Won by hand.',
    'An in-lieu-of alternate is still its own option; the two can share one page.',
  ],
}

export default note
