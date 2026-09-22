import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3721',
  date: '2026-09-22',
  title: 'Digital twins: a fresh robot key tells you how to run the robot from claude.ai or your phone',
  kind: 'feature',
  highlights: [
    'Settings → System → Digital twins: when a new robot key is shown, the card now walks through connecting it from claude.ai, Claude Desktop or the phone app with no Terminal at all — add a custom connector at the address shown, choose No sign-in, paste the header value the card copies, and paste the Console\'s kickoff into a new incognito chat. It works on Claude accounts that already have the Request headers option; the card says what to do if yours does not yet.',
    'The Terminal route is still there for a Claude Desktop without that option, in three plain steps, and the Claude Code handoff is named beneath it. The key itself never goes in a chat.',
    'The guide "run the robot estimator from Claude Desktop" gains the same steps under "From claude.ai or your phone".',
  ],
}

export default note
