import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8159',
  date: '2026-11-21',
  title: 'State roll: a place to keep who holds a state license near us',
  kind: 'infra',
  highlights: [
    'The database can now keep the state’s public roll of licensed plumbers for our counties: the name, the license, its dates, the county and the endorsements.',
    'It keeps what changes from one week to the next, since the state keeps no history of its own.',
    'It keeps no phone, street address or email for a person. The state does not publish them.',
    'Nothing on screen changes yet. The weekly pull and the State roll tab come next.',
  ],
}

export default note
