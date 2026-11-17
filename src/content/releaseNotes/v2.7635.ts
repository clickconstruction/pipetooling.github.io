import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7635',
  date: '2026-11-17',
  title: 'Lien desk: a file that does not go up says why, and Try again sends it again',
  kind: 'fix',
  highlights: [
    'A receipt photo or a mailed copy that did not reach Drive used to say only "failed". It now says who refused and why, in Drive’s own words where Drive gave them.',
    'When a second try can help, such as a lost connection or a busy Drive, Try again sits beside the reason and sends the same file. Nobody takes the photo twice.',
    'A refusal a second try cannot fix, such as a full Drive, shows its reason alone.',
    'Add a file on a job’s Documents tab reads the same reasons, since it uses the same upload.',
  ],
}

export default note
