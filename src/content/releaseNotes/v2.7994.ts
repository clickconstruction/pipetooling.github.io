import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7994',
  date: '2026-11-19',
  title: 'Painted maps: the walk says Precise Location is on, and shows the way to the switch when it looks off',
  kind: 'feature',
  highlights: [
    'While you paint a walk, a line under the length says how your phone’s location is doing. A green tick says Precise Location is on.',
    'A weak signal is one amber line. It says the switch is on and the signal is the trouble.',
    'When your phone gives only a rough area for 4 seconds, the line says Precise Location looks off. It sets your phone’s two numbers side by side and lists the steps to the switch for your phone.',
    'The map then pulls back to a dashed circle you are somewhere in. It comes back in to you on the first sure reading.',
  ],
}

export default note
