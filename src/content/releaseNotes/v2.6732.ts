import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6732',
  date: '2026-11-08',
  title: 'The To chip on Tell the customer and On my way, and the tech may pick the number',
  kind: 'feature',
  highlights: [
    'The Tell the customer sheet shows the To chip beside Text, on a booking and on an estimate alike. A customer with one number sees a label. With two or more, the chip opens the same short menu as the send window: pick a number and the text, or the morning’s text, goes there this once; leave Make this their usual number on and the pick is remembered, with the gray line in the thread.',
    'Job Mode’s On my way shows the chip over the preview. A tech on the job may switch the number this once, and the tick makes it the customer’s usual, which the office sees as the gray line. The tech’s bio follows the same number. Until the database change is in, the sheet shows no chip and the text goes where it always did.',
    'The call’s dial on Follow up and the lien courtesy notice’s text now read the usual number first, like everything else.',
    'On Today’s sends, a held row names the number the text would go to, so a wrong usual is seen before a press. A number that sent STOP is named as the one that sent it.',
  ],
}

export default note
