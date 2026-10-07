import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4761',
  date: '2026-10-07',
  title: 'Pipeline: Billed and Ready to Bill count every bill, on a phone and with the map hidden',
  kind: 'fix',
  highlights: [
    'Opening Billed, Collections or Ready to Bill now loads every unpaid stage, because a bill sits with its job: a progress bill on a Working job, a billed line on a job sent back to Ready to Bill.',
    'Before, the phone board read Billed 64 while the computer said 71: seven bills on jobs in other stages were missing until something else loaded those stages.',
    'The section header keeps the cached count until every job its bills come from is on the board.',
  ],
}

export default note
