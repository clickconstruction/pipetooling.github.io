import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5663',
  date: '2026-10-20',
  title: 'Reports: how far along is each line, not the job',
  kind: 'feature',
  highlights: [
    'On a job with more than one priced line, Leave Report now lists the job’s lines in order and asks how far along each one is. Move the lines you worked on. The rest stay as they are.',
    'The app works out the job’s percent from the lines by their share of the job. Tap how? under the list to see the arithmetic. No prices are shown. The number still lands in How complete is the job?, so the Pipeline, the Dashboard and the activity feed read it as before.',
    'The report names each line you moved, like Rough In 35% → 50%, so the office reads what changed. A line whose draw is paid reads ✓ Paid and stays put. Set the whole-job % instead brings back the slider.',
    'The Additional report window on a job’s reports list asks the same way. One-line jobs keep the slider.',
  ],
}

export default note
