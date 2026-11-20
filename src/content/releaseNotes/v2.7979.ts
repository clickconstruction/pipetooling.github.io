import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7979',
  date: '2026-11-19',
  title: 'Painted maps: the rule for which map a painted map draws on',
  kind: 'infra',
  highlights: [
    'A first step toward reading a painted map over Google Maps, which the owner asked for.',
    'The rule is written and tested. A painted map draws on Google only with a working key, on a screen that is ready for it, and never beside another company’s photograph.',
    'A picture and a printed page of a painted map keep the view from above they use today.',
    'Nothing on a screen changes yet. A Google map for reading a painted map comes next.',
  ],
}

export default note
