import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4823',
  date: '2026-10-07',
  title: 'Lien desk: the run knows the packet already printed',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'When every notice waiting on the desk has printed, the title bar button reads Record the mailing instead of Send the run. It matches the button on each printed notice.',
    'The run then opens on its third step. Step 1 shows the day the packet printed, and the print button reads Print it again, for a lost copy only.',
    'Before this, the run asked you to print the packet a second time, which filed a second copy on every job in it.',
  ],
}

export default note
