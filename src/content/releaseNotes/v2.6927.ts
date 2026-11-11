import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6927',
  date: '2026-11-11',
  title: 'After a combine, you can watch the box photos move to the job’s Drive folder',
  kind: 'feature',
  highlights: [
    'When you combine two jobs, the success message now says how many box photos are moving to the kept job’s Drive folder. They start by themselves, so there is nothing to press.',
    'Open the job on Jobs → Materials, or on the phone’s On site tab, to watch the count go down. You can leave the page: the rest follow by themselves.',
    'A file that cannot move, such as one in Drive’s trash, is named there with its reason and a press to try it again. It is also tried again by itself a day later.',
  ],
}

export default note
