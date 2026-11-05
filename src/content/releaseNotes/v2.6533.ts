import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6533',
  date: '2026-11-04',
  title: 'The material location report: what is in every cage and box across a development, printed to PDF',
  kind: 'feature',
  highlights: [
    'A development’s page has Print the material location report in the head of its Jobs & bids look. One Letter paper shows every cage and box across the site’s jobs with the parts on hand in each, the count, the unit and the day something was last recorded.',
    'Read it by job, with each job’s places and the boxes at each, or by location, with each place across the jobs and every job’s boxes under it. Two chips in the window switch between them and the app remembers your pick.',
    'The head names the site, the day and who printed it. The jobs with nothing on site close the paper in one block, a line each. The foot of every page names the ledger the paper reads.',
    'Press Print, then Save as PDF in the print window. A cage or box and its lines stay together on one page.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
