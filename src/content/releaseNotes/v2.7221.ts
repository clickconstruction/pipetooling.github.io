import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7221',
  date: '2026-11-13',
  title: 'The Bridge: set each job’s percent with its lines, its last day worked and its price in front of you',
  kind: 'feature',
  highlights: [
    'On What to do now, each job under Set a percent now says what we are charging, or No price, and the last day it was worked and by whom. The day is marked clocked or scheduled.',
    'Set the percent opens the percent window with the job’s facts above the control: what we are charging, what has been billed, the job’s lines with their amounts, the last day worked, the next day on the schedule and the hours so far.',
    'Save moves the window on to the next job on the list, so each job is two presses: a percent, then Save. Skip and Back move without saving.',
    'A job you set leaves the list, and the count in the heading drops.',
  ],
}

export default note
