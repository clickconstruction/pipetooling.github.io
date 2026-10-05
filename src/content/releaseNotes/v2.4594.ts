import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4594',
  date: '2026-10-05',
  title: 'Groundwork for seeing who is spending what on the cards',
  kind: 'infra',
  highlights: [
    'The app can now read every card charge in a period at once, with who it belongs to, whether it is fuel and which jobs it went to.',
    'It adds them up by person with the same rules a job’s cost uses, so the totals match the Job window.',
    'Nothing on screen changes yet. People → Spending is next.',
  ],
}

export default note
