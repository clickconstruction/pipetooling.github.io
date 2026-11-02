import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6340',
  date: '2026-11-02',
  title: 'The courtesy notice window makes no Messages contact until a text goes',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Opening Send a courtesy notice on the Lien desk no longer makes the GC a Messages contact. A window opened and cancelled leaves nothing behind, and so does a send by email alone.',
    'A GC with no Messages contact yet shows the number on their customer record in the window, and the text goes to it. The contact is made at the press, only when the text goes, and the text lands in Messages as before.',
    'When the contact cannot be made, say on a training account, the text’s row says so and the email still goes.',
  ],
}

export default note
