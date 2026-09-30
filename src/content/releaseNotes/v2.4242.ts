import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4242',
  date: '2026-09-30',
  title: 'Hours typed by hand are recorded as typed: who typed them, and what was on the day before',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'When someone types hours onto a person’s day — a missed clock-in, a longer day — the app now records who typed them, when, and what the day read before and after. A real clock-in or clock-out is not marked.',
    'The rule this prepares: whoever typed the hours cannot be the one who approves them, and nobody approves their own hours. It is switched on for test accounts only for now.',
    'Nothing on the screens changes with this step. The mark on each approval list, a card for hours waiting on a second person, and a way for a worker to report a day the clock missed come next.',
  ],
}

export default note
