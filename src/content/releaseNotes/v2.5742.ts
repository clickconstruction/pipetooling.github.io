import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5742',
  date: '2026-10-22',
  title: 'Robots: the setup command brings its own Node, and is right wherever it lands',
  kind: 'fix',
  highlights: [
    'Set up on this Mac now works on a Mac that has no Node. The command fetches Node from nodejs.org into your Library folder, checks it, and carries on. No installer, no admin password, nothing else on the Mac changes.',
    'Pasted into a Claude Code session instead of Terminal, the command still works. It connects the robot, keeps the kickoff on your clipboard and in a file, and asks you to quit and reopen Claude yourself.',
    'When something is missing, the command says so in one line and leaves your Terminal window open. It checks for the Claude app before it spends the one-time code.',
  ],
}

export default note
