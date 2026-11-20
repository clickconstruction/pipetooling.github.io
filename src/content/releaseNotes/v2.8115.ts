import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8115',
  date: '2026-11-20',
  title: 'Lien desk: Record it… asks before it ticks, and skips a screen with nothing to tick',
  kind: 'fix',
  highlights: [
    'On a missed notice with no month still due, Record it… now opens with no paper picked and no closed month ticked. You pick the paper and tick the month it stood for. Before, every closed month arrived ticked, and one reason covered them all.',
    'When the desk is asking a job for no month, as on a notice in Sent, Record it… opens straight on the record of a notice sent by hand. Before, it listed the papers over an Apply button that could not be pressed.',
    'On a computer the step now lands inside the window however long it takes to look up the papers on record. Before, a slow lookup could leave its Apply button below the bottom edge.',
  ],
}

export default note
