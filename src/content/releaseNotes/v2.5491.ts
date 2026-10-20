import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5491',
  date: '2026-10-13',
  title: 'Pipeline: a Billed row’s dates say where its lien notice stands',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Under the lien row of a Billed or Collections row’s dates block, one quiet line says where the notice stands in the Lien desk’s own words: waiting on the leader since a day, in the mail owing its number, held, sent and delivered with letter two’s day count, filed and served.',
    'The line is the same reading the Accounts Receivable window shows on its chips, so the two never disagree. Hover it for the whole sentence.',
    'A row with nothing out and nothing due keeps the dates it had.',
  ],
}

export default note
