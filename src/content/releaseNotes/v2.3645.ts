import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3645',
  date: '2026-09-20',
  title: 'Behind the scenes: a job’s parts-cost math moves where a server can read it',
  kind: 'infra',
  highlights: [
    'The calculation behind a job’s Parts Cost — supply-house invoices, card charges and tally parts — now lives where both the app and a developer’s tools use it, so the two can never disagree. Nothing on any screen changes.',
  ],
}

export default note
