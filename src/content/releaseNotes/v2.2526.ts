import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2526',
  date: '2026-08-31',
  title: 'The app calls itself ClickTooling everywhere',
  kind: 'fix',
  highlights: [
    'Every remaining "PipeTooling" in the app — invite and sign-in emails, invoice PDFs, Stripe billing panels, bid tools, help guides — now reads ClickTooling.',
    'The shipped Standard invoice-footer preset now opens with "ClickTooling — Click Plumbing and Electrical".',
    'Estimate emails now show the correct sender address (team@noreply.clicktooling.com).',
  ],
}

export default note
