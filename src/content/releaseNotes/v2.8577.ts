import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8577',
  date: '2026-11-25',
  title: 'Pipeline: the dot that says a customer is waiting now lights',
  kind: 'fix',
  highlights: [
    'When a customer writes about a job and nobody answers, the speech bubble on that job’s Pipeline row now shows its dot.',
    'The row’s activity box draws its bar and says Nobody has answered, and the phone row says it too.',
    'None of the three could show on a real job before. The dot was looked up under the wrong name for the job.',
    'A customer’s line about a bid or a GC project still lights nothing on the Pipeline.',
  ],
}

export default note
