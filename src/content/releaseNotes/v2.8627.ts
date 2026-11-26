import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8627',
  date: '2026-11-26',
  title: 'Painted maps: the developer can reopen an ended link of a test map',
  kind: 'fix',
  highlights: [
    'End this link now kept the link’s row with no way back. A link a walk ended on a ZZ test map stayed ended for good.',
    'A developer now reads Reopen… under Ended links on a test map’s Share sheet. A link not past its day opens again at the same address. A link past its day stays ended; make a new one.',
    'Nothing changes for the crews or the office. Share, End this link now and the reader’s page are as they were.',
  ],
}

export default note
