import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5192',
  date: '2026-10-10',
  title: 'GC mode: an estimator’s board knows which papers are in',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'An estimator’s Project Board now knows when a trade partner’s master agreement, W-9 and insurance are in, as the rest of the office’s does.',
    'Before, they all read as missing, so Follow up asked an estimator to chase a W-9 that was already on file.',
    'The board reads only whether each paper is in, never a W-9’s numbers or a signer’s details.',
  ],
}

export default note
