import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7252',
  date: '2026-11-14',
  title: 'Materials on site: four small things on the phone',
  kind: 'fix',
  highlights: [
    'Count this box now walks a part marked can’t find even when none is left, so a count on the phone clears the mark. Before, only the office could.',
    'On the number sheet you can clear the field and type a number. It no longer snaps back to 1 while you type.',
    'A scanned label that opens no box for you now says the box may be on a job you are not on, or retired. It no longer says the code is on no job.',
    'A box photo that fails to file no longer holds newer photos behind it, once the photo sweep is redeployed.',
  ],
}

export default note
