import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8667',
  date: '2026-11-26',
  title: 'A person\'s desk: a developer sets their seat and their role on CountTooling and TakeoffTooling',
  kind: 'feature',
  highlights: [
    'Access and account on a person\'s desk has a row for CountTooling and a row for TakeoffTooling. Each says whether they have a seat there and offers Make their seat, Retire here or Bring back.',
    'A Role there row sets the role the seat holds on that site. CountTooling has Overseer, Lead and Admin. TakeoffTooling has User, Admin and Dev.',
    'People, Users, Sites now shows who is an overseer or a lead on CountTooling.',
    'The desk asks before it retires a seat or makes someone an admin or a dev. Each site keeps its last admin or dev.',
  ],
}

export default note
