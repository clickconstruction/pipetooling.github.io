import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6401',
  date: '2026-11-02',
  title: 'How fast a change ships: In line now, the merge queue’s line, so you can find your change on its way to the app',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Under the four tiles, In line now lists the changes in the merge queue in the order they go live, the top one next: each with its title in plain words, its place in line, how long it has been in the queue and about how long GitHub says is left.',
    'The first ten are listed and the rest counted. Under the list, one line counts the changes armed and waiting on their checks, naming any held by a red check or a conflict, and the changes open and not yet asked to merge.',
    'An empty queue says so. When the reader could not read the queue, the card says so and names the door for a dev.',
    'The guide see how fast a change ships has a new section, Find your change in line.',
  ],
}

export default note
