import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5881',
  date: '2026-10-26',
  title: 'The Monday sheet is one rule, with the Friday ask on it',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The Monday sheet on the page and the one the email carries are built by one rule from the same reads, so the two can never differ. The weekly send that mails it on Monday morning is next.',
    'When last week’s call has no answer yet, the sheet asks the Friday question. When a read failed, the sheet’s last line says which one, instead of a tile quietly reading without it.',
  ],
}

export default note
