import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4298',
  date: '2026-10-01',
  title: 'Edit Job → Bill: the By bill / By date switch sits on the Bills row',
  kind: 'feature',
  highlights: [
    'The By bill and By date buttons moved down to the Bills row, right above the bills they change. They used to sit on the Bills and payments heading, far above the list.',
    'The Next label on that row is gone. It named the buttons at the right of each bill, and did not say so.',
    'On a phone the switch sits on the Bills row too.',
  ],
}

export default note
