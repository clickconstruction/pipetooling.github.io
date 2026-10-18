import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5610',
  date: '2026-10-18',
  title: 'Training: a course can be open to everyone, and Intro to plumbing begins with Water in',
  kind: 'feature',
  highlights: [
    'A course can now be open to every role while required of some. On the Dashboard’s Training card it sits under an Available line for the roles it is not required of, with Start, Continue or Read it again, and no colour or clock. A dev opens a course with Also open to · Everyone in Settings → Training, which then says how many took it.',
    'The second course, Intro to plumbing, is in the app switched off: a Start here lesson and the ten lessons of Water in, from the meter and the main shutoff to the eight supply fittings, each with a line drawing of the water going through it. The drawings share one language: a pipe is two lines, water is a tint, flow is an arrow.',
    'The course is required of helpers and open to everyone else once a dev turns it on. Water out, the two systems under conditions, and Reading the job follow, a part at a time, with the owner’s corrections.',
  ],
}

export default note
