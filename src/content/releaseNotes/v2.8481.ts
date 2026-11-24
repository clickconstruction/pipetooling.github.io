import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8481',
  date: '2026-11-24',
  title: 'Legal desk: a job counts from the last day of work set by hand',
  kind: 'fix',
  highlights: [
    'The Legal desk and the law firm’s page now count a job’s lien dates from the last day of work set by hand, as the job’s Lien window does.',
    'They used to count from the approved hours, so counsel could see a later last day than the Lien window showed.',
    'The line beside the job says the day was set by hand and gives the reason it was saved with.',
    'Where hours were approved after that day, the line says so and says they do not move it.',
  ],
}

export default note
