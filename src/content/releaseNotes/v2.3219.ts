import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3219',
  date: '2026-09-10',
  title: 'Bid to your marked-up plans: CountTooling exports the sheets, the letter says so',
  kind: 'feature',
  highlights: [
    'Cover Letter step 2 has a Bid basis card. Get marked-up plans from CountTooling opens the takeoff in a new tab with Export PDFs already set to the sheets that carry marks, report first, notes at the back. Download there and the bid is stamped with the file name, the sheets, and a snapshot of the marks.',
    'The file is named to be found again: bid-basis_b409_<project>_<date>_<time>.pdf, bid number first, so a search of your computer for the bid number finds it. The card shows the name with a Copy button, and CountTooling shows it too.',
    'A Bid to our marked-up plans pill puts the Bid basis line in the letter beside the plan date: we bid to our marked-up copy, attached, and our marks govern where they differ. It stays off until an export exists.',
    'Takeoff saved again after the export? The card turns amber and offers Export again. Every export stays in the history, on the card and under Full bid details, and Mark as attached by hand covers a tab that never reported back.',
  ],
}

export default note
