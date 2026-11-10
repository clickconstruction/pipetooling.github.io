import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6838',
  date: '2026-11-10',
  title: 'The Bridge lists every bank account, and you choose which count as cash',
  kind: 'feature',
  highlights: [
    'Under the cash forecast, the Bridge now lists every bank account by the name you gave it in Mercury, with what each one holds.',
    'Each account has a tick box. Clear it to leave that account out of cash on hand, and tick it to count it again. The choice is saved.',
    'Wherever cash on hand shows, the page names the account it leaves out, so a lower figure is never a silent one.',
    'When cash goes under your floor, cash now leads the first screen. The card proposes a call to keep cash above the floor, with the slowest step as the move after.',
  ],
}

export default note
