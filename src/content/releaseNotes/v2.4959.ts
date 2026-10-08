import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4959',
  date: '2026-10-08',
  title: 'GC mode: an answered question says who has the answer',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'After you email an answer about the plans, the questions window now says which companies it went to.',
    'It no longer offers to send the answer again to a company that already has it.',
    'A question a company asked from its portal now reads “asked it” beside that company.',
  ],
}

export default note
