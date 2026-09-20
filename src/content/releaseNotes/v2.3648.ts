import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3648',
  date: '2026-09-20',
  title: 'Digital twins: new robot keys say what they are',
  kind: 'infra',
  highlights: [
    'A robot key issued from Settings → Digital twins, or by “Set up on this Mac”, now starts with ptt_ — so a person or a secret scanner can tell a robot key from a developer key (ptd_) at a glance.',
    'Keys issued before today keep working exactly as they are; nothing needs to be re-issued.',
    'A key taken to the wrong address is turned away at the door with a sentence saying which address it belongs to, instead of a vague sign-in failure.',
  ],
}

export default note
