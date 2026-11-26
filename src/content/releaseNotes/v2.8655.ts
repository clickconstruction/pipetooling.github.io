import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8655',
  date: '2026-11-26',
  title: 'A developer can read the list of TakeoffTooling accounts from here',
  kind: 'infra',
  highlights: [
    'The door a developer uses to reach TakeoffTooling can now ask for its list of accounts.',
    'The list is read only. Nothing on TakeoffTooling changes.',
    'It is the groundwork for seeing every site\'s accounts on People, under Users.',
  ],
}

export default note
