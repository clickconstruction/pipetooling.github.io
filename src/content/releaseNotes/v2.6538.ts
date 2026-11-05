import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6538',
  date: '2026-11-05',
  title: 'The markup on materials shows its margin beside it, and either one can be typed',
  kind: 'feature',
  roles: ['dev', 'controller', 'assistant', 'master_technician'],
  highlights: [
    'Everywhere a markup on materials is entered, two boxes now sit side by side: the markup, a percent over cost, and the margin, a percent of the sale. Type in either and the other follows, so 25% over cost reads as a 20% margin at the same time.',
    'The pair is at all three doors: Settings → Jobs & billing → Markup on materials, the Charges window on the Job Summary, and Edit Job → Charging the customer. The job and the company still keep the markup; the margin is read from it.',
    'A margin of 100% or more has no markup, so the pair says so under the boxes instead of saving a guess. Edit Job’s Charging the customer row now reads the margin along with the markup in force.',
  ],
}

export default note
