import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5179',
  date: '2026-10-10',
  title: 'GC mode: the office can read a trade partner’s papers on the board',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'controller', 'assistant', 'estimator'],
  highlights: [
    'The database can now tell the whole GC office whether a trade partner’s master agreement, W-9 and insurance are in. Before, an estimator’s board showed every one as missing.',
    'Only those papers’ states are shared, never a W-9’s numbers or a signer’s details. The board starts reading it in a coming update.',
  ],
}

export default note
