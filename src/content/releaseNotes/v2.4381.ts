import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4381',
  date: '2026-10-02',
  title: 'Submittals: a carrier takes the place of the one the takeoff priced',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'Make it a part now asks what the new part replaces. For a carrier it picks the carrier the takeoff priced, which comes off. The new one reads in place of it.',
    'Carriers go in at Rough In. A carrier with no stage of its own now shows Rough In on the procurement log, so its order-by date is right.',
    'A row that lists two carriers says so, so you can take the extra one off.',
  ],
}

export default note
