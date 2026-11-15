import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7347',
  date: '2026-11-15',
  title: 'Bids: a priced bid says when it cannot be scored, before it goes out',
  kind: 'feature',
  highlights: [
    'The Pricing workbench says when the bid on screen cannot be scored: labor not estimated, with how many rows have hours, or part of the price on rows with no cost. Open Labor takes you to the hours.',
    'The same words stand at the top of Share with a teammate and under Mark sent on the Cover Letter, the moment the bid’s margin is kept. Nothing is stopped: the bid may still go out.',
    'The Bid Board carries a Can’t be scored chip on those rows. On a bid still on the desk the chip opens its Labor tab.',
    '16 bids won before the award day was recorded now carry one, taken from the day their job was made, so they fall in the right month on the forecast and the scores.',
  ],
}

export default note
