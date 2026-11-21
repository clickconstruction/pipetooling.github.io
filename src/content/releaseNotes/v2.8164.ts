import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8164',
  date: '2026-11-21',
  title: 'State roll: the weekly read of the state’s plumbing licenses',
  kind: 'infra',
  highlights: [
    'Every Monday morning the app can now read the state plumbing board’s public list of masters, journeymen and tradesmen, and keep the ones who live in our counties.',
    'Each week it notes what changed: who is new, who renewed, whose license lapsed and who moved.',
    'It keeps no phone, street address or email, and it never keeps a person who asked to be left off.',
    'Nothing on screen changes yet. The State roll tab comes next.',
  ],
}

export default note
