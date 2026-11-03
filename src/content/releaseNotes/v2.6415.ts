import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6415',
  date: '2026-11-02',
  title: 'Each group of SQL beds runs the migrations once and starts most beds from that copy, so a run takes half the build time',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Each of the 69 database test beds still ran all 1,072 migrations itself. Beside seven others on one machine, that took about two and a half minutes a bed.',
    'Each group of beds now runs them once, saves that database as a copy, and starts 60 of its beds from it in a second or two. Those beds take about 14 seconds instead of 153.',
    'A group takes 2.5 to 4.5 minutes instead of 5 to 8, and a whole run about 16 minutes of build time instead of 32.',
    'The 9 beds that test a migration run twice still run everything themselves. A broken migration still fails every bed and names the file and line.',
  ],
}

export default note
