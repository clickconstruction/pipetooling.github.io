import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2969',
  date: '2026-09-06',
  title: 'Safety net under the invoice PDF',
  kind: 'infra',
  highlights: [
    'Nothing changes in the app. The invoice PDF that Bill Customer emails — its layout, page breaks, payment-history card and the cent-exact split of a bill across fixture lines — plus the footer presets and company identity behind it now have 35 tests pinning their behaviour.',
  ],
}

export default note
