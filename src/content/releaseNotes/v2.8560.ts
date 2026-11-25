import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8560',
  date: '2026-11-24',
  title: 'Task Mode: a task’s lines name who hears for every helper',
  kind: 'fix',
  highlights: [
    'A helper given a task with Tell me lit now reads who hears when it is done, before the start and on the done line.',
    'Before, the lines named nobody when the person who gave the task was one the helper could not look up, such as a dev.',
    'The notes on a task name their writers the same way.',
    'A person who has left is not named as hearing.',
  ],
}

export default note
