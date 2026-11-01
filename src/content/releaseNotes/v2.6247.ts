import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6247',
  date: '2026-10-31',
  title: 'The role line under the business-records preset keeps what you type (punch list #220)',
  kind: 'fix',
  highlights: [
    'Under Business records in Swear a statement…, the first thing typed or pasted into the role line after picking who swears it used to vanish. The line snapped back to the rule’s role. It now keeps what you type.',
    'A role you typed under Business records stays when you press What someone saw or heard.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
