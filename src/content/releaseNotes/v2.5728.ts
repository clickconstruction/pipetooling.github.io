import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5728',
  date: '2026-10-22',
  title: 'Messages: the walk kit is quiet to people',
  kind: 'feature',
  highlights: [
    'Groundwork for the walk kit, the test that runs the whole Messages loop on the company’s own inbox and number. While a walk is set up, its test thread buzzes nobody in the office: a reply on it reaches the devs alone, at once, with no wait push and no after-hours push behind it.',
    'The test thread is never handed to a person by the Who gets a new message rule, and the morning run leaves it out, so no reminder is ever texted or offered to the company’s own number.',
    'Nothing changes while no walk is set up. The office still sees the test thread in Needs a reply for the few minutes of a walk.',
  ],
}

export default note
