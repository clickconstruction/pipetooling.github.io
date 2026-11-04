import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6497',
  date: '2026-11-04',
  title: 'The owner’s email and phone live on the property record',
  kind: 'feature',
  highlights: [
    'The property window has two new fields under Owner mailing address: Owner email and Owner phone. The same two rows show on a job’s Property record panel in Edit Job, and the fields sit on a customer’s property sheet too.',
    'The courtesy notice before a lien reads the owner’s email from the record, so the owner gets their copy once the email is typed. The lien papers do not need either field, so neither counts toward lien-ready.',
    'The owner’s text goes only when the owner’s number already belongs to someone in Messages. Otherwise the window says the owner is not in Messages and the email goes alone.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
