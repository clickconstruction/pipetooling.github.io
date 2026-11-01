import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6252',
  date: '2026-10-31',
  title: 'The adopt window names each version on the preview',
  kind: 'feature',
  highlights: [
    'When you adopt bids into a package, the preview step now shows each version\'s name as a field you can change, right where it says what is about to move. Before, the name was only on the pick list and easy to miss.',
    'The suggested name is still filled in, so nothing changes unless you type.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
