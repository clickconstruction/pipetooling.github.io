import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8350',
  date: '2026-11-23',
  title: 'Working hours: Utilization reads a person\'s set hours',
  kind: 'infra',
  highlights: [
    'The second step of working hours. Once a person has hours set, People, Utilization holds them to those hours and says so, with the times beside the total.',
    'Working hours win over a person\'s own answer. A row with working hours has no Change press, since a dev or the controller sets them on the person\'s sheet.',
    'Nobody has working hours yet, so every row reads as it did. The press that sets them comes next.',
  ],
}

export default note
