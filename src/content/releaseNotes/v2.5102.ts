import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5102',
  date: '2026-10-09',
  title: 'Edit Job: a returned check fee no longer reads as covering the next line',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'After the $30 returned check fee went on a bill, the Bill tab showed the next unbilled line as “$30 of $2,000 covered”. The fee is its bill’s own line, so that line now reads not billed and bills in full.',
  ],
}

export default note
