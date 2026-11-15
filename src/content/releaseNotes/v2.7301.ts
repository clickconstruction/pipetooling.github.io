import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7301',
  date: '2026-11-15',
  title: 'GC difficulty rating, part 4: the price list, and the points become cost lines on the bid',
  kind: 'feature',
  highlights: [
    'On the Bid Board, Pricing rules opens the price list that says what a point costs: a field point is a percent of the bid’s field hours at its labor rate, an office point is office hours at the office rate, the paying point carries the price for the days past the threshold at a monthly rate, and all lines together stop at a percent of the bid’s own cost. The owner and the controller edit it and save the next version; estimators read it. It also says who may rate a GC.',
    'When the Pricing tab first costs a bid to a rated GC, the rating becomes direct-cost rows on the Labor tab, one per scale, and the Workbench reads Difficulty · 4 points · +$6,420 in cost with what that is on the price at the target margin. Open the chip for each line with its arithmetic and its sentence.',
    'Take a line off this bid with a reason: the GC keeps its rating, the bid records who took it off and why. A bid keeps its lines when the GC is rated again or the price list changes; the Workbench says rated higher since this was priced, with a press that reads the new rating in.',
    'The margin kept on the bid at send now keeps the difficulty cost apart.',
  ],
}

export default note
