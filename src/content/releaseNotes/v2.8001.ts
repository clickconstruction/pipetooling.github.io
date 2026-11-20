import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8001',
  date: '2026-11-19',
  title: 'Painted maps: Put the dot where I am leaves the dot where it is on a rough reading, and says why',
  kind: 'feature',
  highlights: [
    'When your phone gives only a rough area, Put the dot where I am no longer sends the dot miles away. The dot stays where you had it.',
    'The panel then says Precise Location looks off, sets your phone’s two numbers side by side and lists the steps to the switch. Drag the dot by hand, or turn the switch on and press again.',
    'A sure reading says Precise Location is on. A weak one moves the dot near you and asks for a drag.',
    'A place added during a walk starts in the middle of the map when the walk’s last reading was rough.',
  ],
}

export default note
