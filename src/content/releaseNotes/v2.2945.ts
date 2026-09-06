import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2945',
  date: '2026-09-06',
  title: '"money story →": one tap from a job to its Job Summary',
  kind: 'feature',
  highlights: [
    'On Jobs → Pipeline, a job\'s activity header now carries a small "money story →" link after "N% complete". It opens Job Summary with that job expanded and scrolled into view — revenue, costs and true profit, one tap from where you already are.',
    'The same link sits in the job window\'s header next to the trade pill.',
    'Shown to dev, master and controller. Assistants keep the Job Summary tab as before but not the shortcut.',
    'If the job is not on the Job Summary list (below the job-number floor or outside the "Worked in" window) you get a short note instead of a silent landing.',
  ],
}

export default note
