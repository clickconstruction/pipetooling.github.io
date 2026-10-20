import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5501',
  date: '2026-10-13',
  title: 'Messages: a new message from a lead or a sub goes to the Customers seat',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A lead, a sub, a supply house and a candidate have no seat of their own. Their new messages now go to the Customers seat.',
    'Before, they went to nobody until someone took them.',
    'Who gets a new message in Settings → Phone and texts says so on its first row. There is no new seat to set.',
  ],
}

export default note
