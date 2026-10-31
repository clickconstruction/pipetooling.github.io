import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6220',
  date: '2026-10-31',
  title: 'GC statements read the office week alone: the old per-sender round retires',
  kind: 'infra',
  highlights: [
    'The Dashboard line for GC statements and the morning statement email have read the whole office week since September 28. Each kept a fallback to the older per-sender round for a database that did not have the week yet. Those fallbacks are gone.',
    'The two database functions behind the per-sender round are dropped in a migration pushed after the new client and the email function are both live.',
    'Before removing anything, prod was read over the four Wednesdays since October 7: no statement round email was ever scheduled, no round mark or word ask was written, and the office week answered. GC Review itself was in use: 49 checks in those weeks.',
    'Nothing changes on screen. The GC statements line still says how many statements are ready to send and opens the list.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
