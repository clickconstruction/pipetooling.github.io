import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8016',
  date: '2026-11-19',
  title: 'Papers: a copy to the signer, and a PDF of a plain paper',
  kind: 'feature',
  highlights: [
    'A person who signs an agreement you emailed now gets their signed copy by email, as a PDF.',
    'A paper of plain words or clauses now has a PDF. Press Open the PDF on its signed record.',
    'An older signed paper gets its PDF the first time someone opens it. Nobody is emailed about an old paper.',
    'An hours statement, a W-9 and a certificate are never emailed. The office gets no copy by email: the signed paper is on Agreements.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
