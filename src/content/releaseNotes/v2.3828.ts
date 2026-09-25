import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3828',
  date: '2026-09-25',
  title: 'Every lien notice carries counsel’s cover letter',
  kind: 'fix',
  highlights: [
    'Notices sent from the Lien desk now carry counsel’s cover letter for the property — commercial, residential or homestead — the same letter Put a GC on notice uses. Before, the desk printed a short “routine notice” paragraph written before counsel’s memo, which never told the owner they may hold the money back.',
    'The desk’s box reads “Include counsel’s cover letter”; the preview, the printed run and the emailed PDF all show the letter. Notices already drafted pick it up when they print.',
    'The letter’s Enclosed line now adds “with invoices” when the unpaid bills ride behind the form, as counsel wrote it. Unticking the letter in Put a GC on notice now sends the form alone.',
  ],
}

export default note
