import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7255',
  date: '2026-11-14',
  title: 'Lien affidavits: the notice record says what its ✓ means',
  kind: 'fix',
  highlights: [
    'The notice record that prints with a lien affidavit has a new box at the top, How to read a block. It says the paper swears two facts about notice: the months of work, and the day each notice was mailed to the owner.',
    'The line that read “Sentences 5 and 6 match the record.” now reads “The paper matches the record.” It then says what the paper swears, such as August 2026 and certified mail on September 22, 2026.',
    'When the paper and the record do not agree, the line says “The paper and the record differ.” It gives what each one says and ends with “Fix one before this is signed.”',
    'The box also says a ✓ does not mean the notice went on time. The grey box headed Ask the attorney first says when it did not. Nothing about what is checked has changed.',
  ],
}

export default note
