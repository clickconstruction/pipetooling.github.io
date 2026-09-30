import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4254',
  date: '2026-09-30',
  title: 'Needs You says when hours typed by hand wait on you, and hours typed onto approved time get a Looks right',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A new Needs You card on the Dashboard: “Hours typed by hand want a second look” — who typed how much for whom. It shows only hours you did not type and that are not your own. Look at them opens the approvals queue on its Typed by hand filter.',
    'Hours typed onto time that was already approved count in pay straight away. They now show in their own section at the top of the queue with a Looks right button — the second look, from someone other than who typed them — and Open day to fix them instead.',
  ],
}

export default note
