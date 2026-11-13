import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7218',
  date: '2026-11-13',
  title: 'Lien affidavits: the notice record asks at the foot of each block, in grey',
  kind: 'feature',
  highlights: [
    'On the notice record that prints with a lien affidavit, the box that sends a paper to the attorney now closes its block. The table of what was mailed comes first.',
    'The box is grey, with a light fill and a wider left edge. The heavy black box and its black ASK FIRST label are gone.',
    'It starts with the same words as the row on the batch help sheet: Ask the attorney first. Then it says which copy went late or is missing, and for which months.',
    'A paper whose notices all stand has On record in the same spot, with no fill. The same papers are flagged as before, and nothing on the affidavit changes.',
  ],
}

export default note
