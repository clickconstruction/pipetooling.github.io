import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3686',
  date: '2026-09-21',
  title: 'Dev MCP keys: the card tells you how to use one, in plain words',
  kind: 'feature',
  highlights: [
    'Settings → Your account → Dev MCP keys: when a new key is shown, the card now walks through connecting Claude in three numbered steps that assume nothing — press Copy setup command, open Terminal and paste, quit and reopen Claude Code. The command does the file editing itself and answers "Saved".',
    'A second set of steps covers claude.ai, Claude Desktop and your phone with no Terminal at all: add a custom connector at the address shown, choose No sign-in, and paste the header value the card copies. It works on accounts that already have the Request headers option; the card says what to do if yours does not yet.',
    'The card links to the guide "connect my coding agent to PipeTooling", which now says the same in the same words.',
  ],
}

export default note
