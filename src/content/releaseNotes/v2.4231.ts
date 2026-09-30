import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4231',
  date: '2026-09-30',
  title: 'Robots: run the estimator from a Claude Code session, where it reads the plans itself',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Bids → Robots → Console now leads with Claude Code: press Copy Code kickoff, paste it into a new session on the Claude app’s Code tab, and the robot pulls every plan sheet through the connector and reads it. Nothing to attach.',
    'The kickoff opens by telling the session to run it, so it starts working instead of asking what to do with the pasted text. It keeps the robot to its own connector, away from the app’s code and other connectors.',
    'Two sessions can run side by side. Each claims its own bid, and a session that finds a bid another one touched in the last hour leaves it alone.',
    'The chat kickoff stays for claude.ai or a phone, and now says what a chat costs: you drag in each plan PDF, and Claude asks once for each robot tool.',
  ],
}

export default note
