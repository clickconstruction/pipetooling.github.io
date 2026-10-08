import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4991',
  date: '2026-10-08',
  title: 'Pipeline: the billed-money windows moved to their own file',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the windows the Billed money opens moved out of the Pipeline board into one file of their own. They are who owes what, the aging chart, the payment forecast, call mode, Fix bill lines, the promised pay date, the paid profit chart and the billed report.',
    'Nothing changes on screen. Each window opens from the same place and reads the same bills.',
    'New tests cover which bills each window reads, the office-only buttons, and every way back to the board.',
  ],
}

export default note
