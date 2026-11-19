import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7962',
  date: '2026-11-19',
  title: 'Robots: an assistant can set a Mac up to make the rounds',
  kind: 'infra',
  highlights: [
    'A developer’s assistant can now install the robot rounds on a Mac from its own shell, where it took a person pasting the Set up on this Mac command.',
    'It installs the same four files and the same agent as that command, and can first say what it would do without touching anything.',
    'It checks that Claude Code is on the Mac and signed in before it writes, and it never shows the robot’s key.',
  ],
}

export default note
