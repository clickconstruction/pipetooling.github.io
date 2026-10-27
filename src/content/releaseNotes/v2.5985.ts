import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5985',
  date: '2026-10-27',
  title: 'Attach the notarized PDF to a lien waiver',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'A lien waiver printed for a notary now takes the notarized PDF itself. Under When it comes back, Attach the notarized PDF stores the file with the job and marks the waiver signed before a notary. The Google Drive link still works beside it.',
    'Send to the GC attaches that PDF to the email, and Download PDF hands it over. An online notary’s session ends with a sealed PDF, and a scan of the stamped paper works the same way. Files up to 4 MB, so they always fit in an email.',
    'A waiver out for a notary opens again when you reopen the window from its bill, so the copy can be filed days after the print.',
    'The panel says an online notary can also notarize the printed page over video, which Texas has allowed since 2024.',
  ],
}

export default note
