import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6806',
  date: '2026-11-09',
  title: 'The dev seat reads a large file off a mail whole: in pieces that fit, with the argument that reads on',
  kind: 'fix',
  highlights: [
    "A dev's coding agent can now read a mail's attached file of any size up to 10 MB. A file too large for one reply comes a piece at a time, and each reply says where the next piece starts.",
    'Before, a file over about 59 KB came back cut off in the middle and could not be opened. Nothing said so except a line at the very end.',
    'Every piece carries the size and the fingerprint of the whole file, so the agent can check that what it joined is the file that was sent.',
    'Filing a file from a mail onto a job, a person or a matter is unchanged: the file never passed through the agent, so it was never cut.',
  ],
}

export default note
