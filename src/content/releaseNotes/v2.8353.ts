import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8353',
  date: '2026-11-23',
  title: 'Working hours: set a start and an end for each day of a person\'s week',
  kind: 'feature',
  highlights: [
    'A person\'s sheet has a new line under Pay & schedule, Working hours. A dev or the controller sets a start and an end for each day there, in 15-minute blocks, like 6:00 AM to 12:00 PM on five days.',
    'Days that share their hours are one line. Press the hours to change the whole line at once. Give one day its own hours for a half day, add a break for lunch, or make a day off.',
    'Before you keep a change, the line says what it comes to and whether pay moves. For a person on a set week, pay follows the hours in the same save.',
    'Everyone else who reads the sheet sees the same hours with no press. Earlier hours shows what they were before, who set them and why. The person reads their own hours at the foot of My Time, and is told a week ahead when they are about to change.',
  ],
}

export default note
