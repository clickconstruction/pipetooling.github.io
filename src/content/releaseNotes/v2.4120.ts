import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4120',
  date: '2026-09-29',
  title: 'Submittals: Walk me through it catches up with the road',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'The walkthrough no longer rings six tiles that are not there: its stop is the one line under Reasons & cut sheets, and it names proposed and missing among the counts.',
    'The Build Rev 1 stop says what each source builds — the quotes compared, the schedule alone, or the takeoff — and the rows stop covers Split, ×, and + Add from the takeoff.',
    'The Resubmit stop allows for a row fixed with Edit, not only a pick changed on Pricing.',
    'The strip’s first pill reads Sources, matching the stage it opens, Where the rows come from; the help guide’s opening and its tiles sentence say the same.',
  ],
}

export default note
