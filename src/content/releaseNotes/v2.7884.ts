import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7884',
  date: '2026-11-18',
  title: 'Trips: combining two jobs keeps a trip the job held',
  kind: 'fix',
  highlights: [
    'A job that is in no development can hold a trip by itself. When that job was combined into another, the trip went away with it.',
    'The combine now moves the trip to the job that is kept. When the kept job is in a development, the trip becomes that development’s trip and names the kept job.',
    'The trip keeps its number when it can. It takes the next number only when its new home has already used that one.',
  ],
}

export default note
