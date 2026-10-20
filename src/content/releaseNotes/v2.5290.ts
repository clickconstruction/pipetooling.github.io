import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5290',
  date: '2026-10-12',
  title: "Messages: the office can see which papers a customer opened on their page",
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The app can now list, for each customer, our contract, each change order and each pay application we sent, and whether they opened it on their page.',
    'Everyone in the office can read it, with the number, the job and the day. The amounts stay with the money team.',
    'It feeds the portal line on a customer’s conversation and Follow up’s rows for a paper that was opened and not signed.',
    'Nothing changes on screen yet. Those screens come in the next parts.',
  ],
}

export default note
