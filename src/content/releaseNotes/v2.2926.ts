import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2926',
  date: '2026-09-06',
  title: 'Role sweep migration: functions with no role literal are skipped, not fatal',
  kind: 'fix',
  highlights: [
    'The v2.2920 role sweep aborted on its first production push because one Banking function has no role literal at all (it relies on table security). The sweep now notes and skips such functions instead of stopping.',
  ],
}

export default note
