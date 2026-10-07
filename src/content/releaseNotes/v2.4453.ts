import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4453',
  date: '2026-10-02',
  title: 'Bids on a phone: five tabs no longer slide sideways',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'],
  highlights: [
    'On a phone, the whole page no longer slides sideways on Labor, RFI, Change order, Pricing or Cover Letter.',
    'On Labor, the labor book table scrolls inside its own box. The print buttons sit below the labor rate.',
    'On RFI and Change order, each field sits under its label. On Pricing, the What the bid is made of tiles stack. On Cover Letter, the open RFIs note wraps.',
    'On a computer nothing moves.',
  ],
}

export default note
