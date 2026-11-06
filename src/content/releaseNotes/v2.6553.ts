import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6553',
  date: '2026-11-05',
  title: 'A check with Dispatch shows on the job: the Pipeline’s stage name flies a flag, the Documents row wears the chip, and the question wears the Stage check tag (punch list #245 closed)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent', 'estimator'],
  highlights: [
    'While a check on a stage is with Dispatch, the Pipeline row’s stage name wears a small flag instead of the box, and holding the pointer on it reads with Dispatch.',
    'The job’s Documents tab shows the check’s row with the With Dispatch chip, its age and its reason, and Dispatch’s last reply under it.',
    'Questions on this job, and the Development page’s questions, mark a check the crew sent with the Stage check tag the inbox uses.',
    'This was the card’s last PR after the send and the context window, so punch list #245 closes.',
  ],
}

export default note
