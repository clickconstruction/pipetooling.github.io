import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2794',
  date: '2026-09-04',
  title: 'Form Studio: upload a PDF and place the boxes a signer fills',
  kind: 'feature',
  highlights: [
    'Dev-only, in People → Contracts → Contract library → Forms: upload an official form like the W-9, import its fillable fields as boxes, drag them into place, and mark which answers are sensitive.',
    'Preview fills the real PDF with sample values so you see exactly what the signer will see. Publish turns the form into a Contract Book entry that packets, sends, and the portal treat like any other document.',
    'An agent can draft a form from a PDF with the new forms scripts and hand back the filled page as an image; import the JSON in the studio to finish placement.',
  ],
}

export default note
