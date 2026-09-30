import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4263',
  date: '2026-09-30',
  title: 'The Hours grid stops before a typed 0 writes over clocked hours, and a dev switches the second-person rule on',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Typing 0 into a Hours grid cell that has approved hours from the clock no longer takes them out of pay behind the clock’s back. The grid asks, and Open the day takes you to the sessions — a change there is recorded and gets a second look.',
    'Settings → People & teams (dev): Typed hours — a second person approves. Off, Test accounts only, or On for everyone. Typed hours wear the pencil whatever is picked; the switch is whether whoever typed them, or the person themself, is held from approving.',
    'An old Quickfill hours grid that nothing showed any more, and that wrote pay totals directly, is gone.',
  ],
}

export default note
