import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6095',
  date: '2026-10-29',
  title: 'Supply-house bills: the PDF fills in the Add invoice window',
  kind: 'feature',
  highlights: [
    'The Add invoice window on Materials → Supply houses now opens with The bill as its first question: start from a PDF or picture on the house’s thread, another file, or no PDF. Picking one fills the fields, green from the paper and amber where the form had to guess, with one sentence and a Yes beside each guess.',
    'The checks are sentences under the fields: the lines add to the total or they do not, a number already on the list, a letterhead that is not this house, a statement. Save still works, and nothing is written until you press it.',
    'Two doors open the form from where the PDF already sits: Record this bill on the house’s thread in Messages, and N bills to record on the house’s row.',
    'The bill sits beside the fields while you check it, a strip above them on a phone, and our copy becomes the row’s View. Use a Drive link instead if you want the AP folder’s copy.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
