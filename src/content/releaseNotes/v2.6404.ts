import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6404',
  date: '2026-11-02',
  title: 'Each SQL bed applies its migrations through one psql, so a run of the beds takes 40% less build time',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Each of the database test beds started a new program in Docker for every one of our 1,072 migrations, eight beds to a machine. That loop was most of a run.',
    'A bed now sends them all through one program, each file in a clean session of its own. A group of beds took 10 to 17 minutes and now takes 8 or 9, and a whole run uses about 41 minutes of build time, down from 67.',
    'A migration that fails still stops the bed. The bed names the file, and now the line in that file too.',
    'A new small bed checks these promises on every run, including a failure in the middle of a run.',
  ],
}

export default note
