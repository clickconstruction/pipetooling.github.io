import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5073',
  date: '2026-10-09',
  title: 'Lien desk: preview the courtesy email before the run is recorded',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'In the run window, the original contractor’s Courtesy PDF line now ends with Preview the email. It opens the email in a new tab, as the GC would get it, with the PDF it attaches. Nothing is sent.',
    'The courtesy email now ends with the office’s number: “For questions call the office: (512) 360-0599”.',
  ],
}

export default note
