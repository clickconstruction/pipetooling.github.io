import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4052',
  date: '2026-09-28',
  title: 'Pipeline: the stage pills never lose their last word',
  kind: 'fix',
  highlights: [
    'The row of stage pills on a Pipeline job (① Rough › ② Top Out › ③ Finish) wraps onto a second line when it is too wide for the column, instead of cutting off the last stage.',
    'The arrows between the pills are now small chevrons and the pills sit a touch closer, so a three-stage job fits on one line a little more often.',
  ],
}

export default note
