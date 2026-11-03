import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6417',
  date: '2026-11-02',
  title: 'Search every file deeply: a file moved into the Shared Drive is indexed whatever date it carries',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The ten-minute sweep found new files by their modified time, and a file moved into the drive from somewhere else keeps its old one, so the sweep never saw it. Most of the job files carried a date older than the drive.',
    'Each run now also compares what the drive holds with what the index holds and reads the files with no row, newest first, forty a run. A folder of two hundred files moved in is read within the working day.',
    'The new step runs last, after the sweep has saved its place and rechecked its oldest rows, so a heavy file there costs neither. Its old dates never move the sweep backwards.',
    'The dev terminal check says the sweep now takes a file with no row too. Its fill is for when you cannot wait.',
  ],
}

export default note
