import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6592',
  date: '2026-11-06',
  title: 'Task cards learn a percent, Done when… lines and photos: the ground',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Nothing changes on screen yet. This is the ground under the next three changes: a card on Checklist, the Dashboard and the Roadmap that carries how far along it is instead of a tick, the Done when… lines its writer lists, and the photos taken on it.',
    'The database now keeps a percent on every card’s day row and on every roadmap task, a writer’s Asks for a photo switch, the lines and their ticks, and the photos until they are filed in Drive. Done and 100 mean the same thing; a reopened card starts over at 0.',
    'The rules that read them are written once and tested: which cards take the ring (one-offs and roadmap cards, never a repeating card), how ticks become a percent (2 of 3 is 67), when a photo is offered or required, and how a stage’s bar adds the fractions.',
  ],
}

export default note
