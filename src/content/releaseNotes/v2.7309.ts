import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7309',
  date: '2026-11-15',
  title: 'The job window on a phone: every small press gets a thumb’s square',
  kind: 'fix',
  highlights: [
    'On a phone every press in the job window that stood under 40 px, such as a row’s blue act, a pencil, Print or a draw chip, now answers to a 44 px square around it. Nothing moved; the square is unseen.',
    'The History tab’s range picker is 16 px and 40 px tall on a phone, so an iPhone no longer zooms the page when you tap it.',
  ],
}

export default note
