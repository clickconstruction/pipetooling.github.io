import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6123',
  date: '2026-10-30',
  title: 'Dev MCP keys: the setup command now reaches the Claude app, not only Terminal',
  kind: 'fix',
  highlights: [
    'Copy setup command on the Dev MCP keys card now writes your key into Claude Code’s own settings as well as your shell profile, so a session the Claude app opens from the Dock has the key too.',
    'Until now the app never read the profile, so its sessions showed dev-mcp as connected and every call answered unknown or revoked key, even with a good key.',
    'The three steps are unchanged: copy, paste into Terminal, quit and reopen Claude Code. The key still never goes in a chat or in the repo.',
  ],
}

export default note
