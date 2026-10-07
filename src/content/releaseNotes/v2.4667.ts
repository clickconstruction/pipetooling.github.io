import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4667',
  date: '2026-10-06',
  title: 'Submittals: a revision answered by email stays on the GC’s page',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'When the GC answers a submittal by email and you type their answers in, that revision now shows on their review page as the record, once its package is built. It reads like “Rev 3 · answered by email · Oct 2”.',
    'The page’s procurement card keeps every fixture approved that way, so nothing drops off when the next revision is shared.',
    'Their call says what typing their answer will do before you type it. The line under the rows says what the link shows, like “the link shows Rev 3, answered by email”.',
  ],
}

export default note
