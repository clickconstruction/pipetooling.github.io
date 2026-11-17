import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7515',
  date: '2026-11-16',
  title: 'Filed liens: an assistant can record the mailed copies and list what is left',
  kind: 'infra',
  highlights: [
    'A developer’s assistant can now record that a filed lien’s copies were mailed: the day, each copy’s certified mail number and a photo of its receipt.',
    'It writes what Record service writes on the Lien window, and keeps any number or photo already saved.',
    'It can also list every filed lien that still lacks something: a saved copy, a recording number, or its copies mailed, with how many days are left.',
    'Nothing is mailed or printed by it.',
  ],
}

export default note
