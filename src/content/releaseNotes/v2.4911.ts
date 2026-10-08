import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4911',
  date: '2026-10-07',
  title: 'People → Review: Labor contributors adds up to the job',
  kind: 'fix',
  highlights: [
    'A sub sheet priced as a flat dollar line, with no hours, showed a dash in the Labor contributors window. Its money was missing, so the rows came up short of the job’s total.',
    'The window now prices each sub sheet the way the job does. Its rows add up to the total shown at the top.',
  ],
  roles: ['dev', 'master_technician'],
}

export default note
