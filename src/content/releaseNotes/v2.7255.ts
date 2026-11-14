import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7255',
  date: '2026-11-14',
  title: 'Lien affidavits: the notice record explains itself',
  kind: 'fix',
  highlights: [
    'The notice record that prints with a lien affidavit has a new box at the top, How to read a block. It says the paper swears two facts about notice. It also says a ✓ means the paper and the record agree, not that the notice went on time.',
    'The line that read “Sentences 5 and 6 match the record.” now reads “The paper matches the record.” and says what the paper swears. When the two do not agree it reads “The paper and the record differ.”, gives what each says, and ends “Fix one before this is signed.”',
    'The table of copies has no row of column titles. Each copy sits right under its notice, and each cell says what it is: Copy to the owner, Mailed Sep 22, 2026, Certified mail, No. and the mail number.',
    'A missing line now leads with what to do, such as “To add, if mailed. The original contractor’s copy of notice 1.” The Left off the paper line is one short sentence. Nothing about what is checked has changed.',
  ],
}

export default note
