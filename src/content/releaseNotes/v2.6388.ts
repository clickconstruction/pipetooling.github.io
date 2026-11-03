import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6388',
  date: '2026-11-02',
  title: 'Job Summary: a billed job under 100% earns by its %, the Jobs tile says what the rows are, and a crew report’s % reads as the crew’s',
  kind: 'fix',
  highlights: [
    'A job whose status is billed but whose % column is under 100 now earns revenue by that %, the same rule as every other in-progress job. Job 804 read $32,600 earned over a hover that said contract × 40%. It now reads $13,040, and its gross, margin, true profit and $/hr follow.',
    'While the search box holds something, the Jobs tile’s second line reads “matching your search” instead of naming the Show and Worked in chips that stepped aside for it. With nothing typed it reads as before, with the month kept as a name.',
    'A % that came from a crew report now carries “crew report Oct 30” on Job Summary instead of “set by office”. The report’s own copy into the job landed a moment after the report and was being read as a hand-set by the office.',
  ],
  roles: ['dev', 'master_technician', 'controller'],
}

export default note
