import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6465',
  date: '2026-11-03',
  title: 'Every card line on a big job is counted in the Job window, the cost print and the Job History day',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Job window now reads every card line on a job a page at a time. Its read had a quiet cut at 1,000 lines, and a busy job’s card lines were getting close.',
    'The Job Summary’s cost breakdown print and a day in Projects → Job History read the same way. A big job’s newest card charges are no longer left off.',
  ],
}

export default note
