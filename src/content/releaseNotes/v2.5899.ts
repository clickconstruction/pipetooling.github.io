import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5899',
  date: '2026-10-26',
  title: 'Dev MCP keys: copy a key again from the card',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Each live key you issue from now on has a Copy button on Settings → Your account → Dev MCP keys. It asks first, puts the key on the clipboard and shows it with the setup buttons.',
    'The key is kept encrypted in the database’s vault and leaves it the moment the key is revoked. Only you can copy your own keys, and every copy is logged with your name; the row says when it was last copied.',
    'Keys issued before today were never kept, only checked, so they say “cannot be copied”. Issue a new one, set the machine up, then revoke the old one.',
    'If the browser will not let the page copy, the card selects the text so ⌘ C takes it.',
  ],
}

export default note
