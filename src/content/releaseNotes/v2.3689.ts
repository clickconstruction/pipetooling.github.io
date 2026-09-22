import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3689',
  date: '2026-09-21',
  title: 'Balances: the open reports come first',
  kind: 'feature',
  highlights: [
    'People → Pay → Payroll → Balances now opens on a person’s open reports, oldest week on top: hours, net pay, paid to date, balance and a Payment column with the same words Pay run uses, plus Pay to here — what one send must be to clear every week through that one.',
    'Two states the page never named before: residue (a week short of net by under $5 — fees or rounding, not debt) and overpaid (payments past net). Click a row to see the payments recorded against that week.',
    'Charges and credits that never sat on a report have their own strip, and weeks with hours but no report yet show as their own rows with an estimate and a Report button. One settle-up line does the real sum — including when someone’s charges cover their open weeks.',
    'The dated statement with its running balance folds underneath, grouped by report (each payment under the week it settled) or in date order, where every paid-out row now names the week it was recorded against.',
  ],
}

export default note
