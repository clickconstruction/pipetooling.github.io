import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8038',
  date: '2026-11-20',
  title: 'Gear menu: Job Mode, Dispatch Mode and Task Mode are one at a time',
  kind: 'fix',
  highlights: [
    'The gear menu now ticks only the mode you are in. Job Mode and Task Mode could both show a tick before, while the page was in Task Mode.',
    'Tapping a mode switches to it and the tick moves with it. Turning a mode off takes you back to the mode you had, so leaving Task Mode puts a field hand back in Job Mode.',
    'A master technician who turned Job Mode on now gets the Job Mode bar with it, in place of the Dispatch Mode bar. Turning Job Mode off brings Dispatch Mode back.',
    'Pin Mode, Fix Mode and Dark Mode still go on and off by themselves.',
  ],
}

export default note
