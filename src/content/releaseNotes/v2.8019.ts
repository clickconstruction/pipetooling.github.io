import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8019',
  date: '2026-11-19',
  title: 'Contracts and clauses: a paper can be built from settings',
  kind: 'feature',
  highlights: [
    'A controller or a dev can give a contract paper a settings list: each setting, with its choices from loosest to strictest.',
    'A clause can be tied to one choice with an Only when line. The preview puts the paper together for any mix of choices.',
    'The paper’s card says what would stop it going, in words, and whether an attorney has read its revision.',
    'A paper built from settings goes to nobody yet. A clause now keeps the line breaks it was written with.',
  ],
}

export default note
