import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2519',
  date: '2026-08-30',
  title: 'Audits tab wired to the one-button finish',
  kind: 'feature',
  highlights: [
    'Finish audit and Reopen on the Audits tab now go through the server, so marking the robot’s takeoff reviewed in CountTooling happens in the same click.',
    'The toast confirms when the takeoff was flipped too; if the server hop ever fails, the audit still finishes here and the robot reconciles the rest.',
  ],
}

export default note
