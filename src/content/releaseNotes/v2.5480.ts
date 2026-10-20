import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5480',
  date: '2026-10-13',
  title: 'Lien desk: what each Docsmit envelope cost, read from the mail service (Docsmit train, 6b, the cost line)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Once the post office has an envelope, the hourly poll reads what Docsmit charged for it and keeps the figure on the envelope.',
    'A sent notice’s footer shows the charge beside each envelope and a cost line summing the envelopes read so far.',
    'Every message sent through Docsmit now carries the job number as its bill-to code, so Docsmit’s own invoices group by job.',
  ],
}

export default note
