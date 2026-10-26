import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5851',
  date: '2026-10-25',
  title: 'Legal desk: one timeline with lanes, six tabs',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Timeline is now the desk’s one line. Chips narrow it to Said (contacts, promises, calls and the collections note, with Hold from counsel on each), Did (bills, payments, events, the firm’s entries), Paper (documents, demand letters, lien paper and the clock’s deadlines) or Planned.',
    'The Record of contact tab and “What we did, in order” are gone from the desk; both live on the line. Fees & steps reads With the firm: the floor, the offers, the conversation, the fees and what goes to the firm. Six tabs.',
    'The firm’s portal keeps its own tabs, Record of contact among them.',
  ],
}

export default note
