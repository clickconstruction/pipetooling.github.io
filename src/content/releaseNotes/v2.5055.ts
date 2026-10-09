import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5055',
  date: '2026-10-09',
  title: 'GC projects: answer a trade partner’s ask for a change',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A GC job’s Change orders lists each change a trade partner asked for in its portal, with what it asks and the days it adds.',
    'Make a change order drafts it on that trade. Their ask is our cost, and the price starts at the cost plus our fee.',
    'Turn down asks why. The company gets an email with your reason.',
    'The company hears when its change goes to the customer and when the customer says no. Tell sends that email if it did not go.',
  ],
}

export default note
