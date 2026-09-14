import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3433',
  date: '2026-09-14',
  title: 'Demand letter: every line names its basis',
  kind: 'feature',
  highlights: [
    'The letter now states the date attorney’s fees become recoverable — 30 days after it goes out — beside the pay-by date, so the one date a lawyer needs is on the page.',
    'The vague “late fees may accrue” line is gone. The letter names the interest it can actually claim: 1.5 % a month under the Prompt Payment chapter when the bill went out as a written payment request, or the 6 % legal rate when it never did — with the day it starts.',
    'A mechanic’s-lien line is offered only while a lien can really be filed: the switch is greyed with the reason when the filing window has closed, the property is a homestead, or there is no work month yet. “Small-claims lawsuit” now reads as the court that would hear it.',
    'The Legal desk’s Paper tab shows the fee date and how many exhibits went out with each letter.',
  ],
}

export default note
