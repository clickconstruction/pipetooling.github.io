import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5652',
  date: '2026-10-19',
  title: 'Pricing: the crew rate stands in until a bid has a labor rate of its own',
  kind: 'fix',
  highlights: [
    'A bid whose hours came from the labor book used to cost its labor at $0 until someone typed a rate on Labor, so the Workbench called the bid uncosted and its margin read high.',
    'Now the company crew rate (the last 90 days’ field wage with burden, the number the Labor tab already shows) stands in. The Workbench, the print and the letter all read it; the strip’s cost hover says so.',
    'Typing a rate on Labor still wins. A bid that already had one changes nothing.',
    'A sale-price cell you click into and leave without typing no longer raises the sent-bid notice.',
  ],
}

export default note
