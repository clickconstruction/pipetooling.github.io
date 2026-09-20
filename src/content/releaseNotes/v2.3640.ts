import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3640',
  date: '2026-09-20',
  title: 'Developers: a read-only door for coding agents — Dev MCP keys',
  kind: 'infra',
  highlights: [
    'Settings → Digital twins has a new Dev MCP keys card (developers only): issue a key per machine, and a coding agent can read PipeTooling exactly as that developer sees it.',
    'The door is read-only — the database itself refuses any change — secret values such as portal tokens are hidden, and every call is logged by name.',
    'Revoke a key by its label to cut off one machine; a key also stops working if its owner is no longer a developer.',
  ],
}

export default note
