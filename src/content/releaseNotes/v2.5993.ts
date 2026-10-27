import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5993',
  date: '2026-10-27',
  title: 'Download a sent estimate as a PDF',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'estimator', 'superintendent', 'dev'],
  highlights: [
    'A sent, accepted or declined estimate now has Download PDF beside Copy customer link. The file reads as the customer page does: the title, the address, the good-through day, every option with its lines and total, the terms, and the company’s letterhead.',
    'The link to approve is not in the file, so a PDF a city passes around carries nothing that can be misused. Its last line says to approve from the link in the email.',
    'The download is filed as a sent copy, so the job’s Documents tab shows it went, as a print does.',
  ],
}

export default note
