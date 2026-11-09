import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6694',
  date: '2026-11-08',
  title: 'The estimator who wrote a signed estimate is one of the job’s people',
  kind: 'feature',
  highlights: [
    'When a job is made from a signed estimate, the estimator who wrote the estimate now counts among the job’s people, the same as the estimator of a won bid. They can write down and read the customer’s word on paying for that job, see its money line and be given its paid claim. The office, the job’s account manager and the bid’s estimator or account manager stay as they were.',
    'Wherever a job’s people are listed by name, that person wears a small red E beside their name: the people line over Job activity, the Assigned Team on a job’s window, and Everyone on the job from the Pipeline’s crew line. Press the E and the estimate opens. An author the office never put on the team is listed all the same, with “wrote the estimate” for a status.',
    'Two of the owner’s three calls on the leftovers stay as they are: any estimator still reaches the supply-house account of any job opened from a bid, and a customer’s word that they paid still comes back to whoever heard it after seven days with nothing landed.',
  ],
}

export default note
