import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5512',
  date: '2026-10-13',
  title: 'Dashboard: the idle-jobs card opens the Follow-ups deck with Review them',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Needs you card “N open jobs have sat idle 21+ days” now ends in Review them. It opens the Follow-ups deck on its Idle lens, one card per job, each saying what the job needs with a door for it, instead of the Cycle view’s list.',
    'The card and the deck count the same jobs by construction: a job with a visit already on the schedule, a job snoozed, or one marked Looks fine inside its rest, leaves both at once.',
    'The card’s words say what you will find: the contract with no crew on site, how many are yours, and that Looks fine and Snooze remember your call.',
  ],
}

export default note
