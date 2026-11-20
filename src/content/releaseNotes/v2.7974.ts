import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7974',
  date: '2026-11-19',
  title: 'Robots: an assistant can make a twin’s held seat again',
  kind: 'infra',
  highlights: [
    'A twin holds a seat in CountTooling and in TakeoffTooling. When one was not made, a developer’s assistant can now try it again, as the link button on the twin’s row does.',
    'The plan says where each seat stands before anything is written.',
    'When the other app does not answer, the plan says it could not read the seat. It never calls that seat held.',
    'A seat that already exists in the other app is found, never made twice.',
  ],
}

export default note
