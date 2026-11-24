import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8441',
  date: '2026-11-24',
  title: 'Punch list: your own tick is cleared after 12 quiet hours',
  kind: 'feature',
  highlights: [
    'Your tick on a punch list card is now cleared once your claim has been quiet for 12 hours. Taunya was asked on 2026-11-22 whether it should stay or go, and answered on 2026-11-24: wipe it.',
    'The next time you open the board your box is empty, and the card says “Your tick was cleared after 12 quiet hours. Tick the card again if you are still on it.” That line shows on that visit only.',
    'Still on it is no longer offered, because no quiet tick is left to renew. To keep a card past 12 hours you tick it again, or untick it and tick it again before the time is up.',
    'Everyone else still reads the card as free to pick up, with who had it, until that person next opens the board. A tick renewed on your phone is never cleared by a page left open at your desk.',
  ],
}

export default note
