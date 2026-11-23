import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8406',
  date: '2026-11-23',
  title: 'Supply house bills: the database can search every bill at once',
  kind: 'feature',
  highlights: [
    'Groundwork for one search across every supply house bill. The database can now find a bill by its number, its supply house, its PO, its amount or a part printed on it.',
    'Only someone who can already read bills finds any.',
    'Nothing on screen changes yet. The search box on Materials, Supply houses comes next.',
  ],
}

export default note
