import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6463',
  date: '2026-11-03',
  title: 'Every card line on a big job is counted, through the dev seat and on the Development page',
  kind: 'fix',
  roles: ['dev', 'controller'],
  highlights: [
    'An agent reading a job through the dev seat now counts every card line, supply invoice and sub sheet. A busy job’s card charges had stopped at the first 200 lines.',
    'The Development page now reads every cost row on its jobs a page at a time. Its read had a quiet cut at 1,000 rows, and a busy site’s card lines were getting close.',
  ],
}

export default note
