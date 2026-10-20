import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5530',
  date: '2026-10-14',
  title: 'Lien desk: Esc closes the run window, and it no longer closes over unsaved work',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Esc now closes the Lien desk’s run window, the one Record the mailing opens. It goes one layer at a time: the take back question and More close first, a preview or the Docsmit review closes on its own, and a signature pane makes it wait.',
    'Once anything in the run changes, a typed tracking number, a send method, the Mailed on day or a mailing through Docsmit, neither Esc nor a click outside closes it. A note says why. The × still closes it.',
  ],
}

export default note
