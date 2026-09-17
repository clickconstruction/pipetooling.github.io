import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3556',
  date: '2026-09-17',
  title: 'Estimates: offer add-ons beside the choices',
  kind: 'feature',
  highlights: [
    'On a draft estimate, each option now has an Offered as switch: one of the choices (the customer picks exactly one, as before) or an add-on (they tick any). Make every option an add-on when there is nothing to choose between.',
    'The option cards say how each is offered and show add-on prices with a +. The star stays on a choice; on an all-add-on estimate it marks the one the Pipeline shows until the customer decides.',
    'After they sign, the Customer acceptance record reads what they took — Accepted "Replace 50-gal" + 2 add-ons · $5,740.00 (of 4 offered) — with each add-on and each passed-on option listed. The job\'s Signed agreement note says the same.',
    'The Estimates list marks a row with add-ons out with the customer: · 4 options · 2 add-ons.',
  ],
}

export default note
