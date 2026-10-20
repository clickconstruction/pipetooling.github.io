import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5557',
  date: '2026-10-15',
  title: 'Customers: a list of cards, like Trade partners, as the first view',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Customers on GC projects opens on a list now. Each customer has a card: the band names them, counts their jobs and says how they stand in one chip. Under it, the person to call with their phone and email, the address, whether the master agreement is signed, and when they last opened their portal.',
    'Each job is a row with its stage on the Project Board, the step it is on with its day, and the next press: Remind, Bill day, or Open the card.',
    'The customers who need a hand come first. A customer off the flow sits at the foot in grey. By step and By company are one press away.',
  ],
}

export default note
