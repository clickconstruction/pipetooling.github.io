import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2801',
  date: '2026-09-05',
  title: 'Contracts: enter a form a sub filled out on paper',
  kind: 'feature',
  highlights: [
    'People → Contracts → + Add document now offers "Enter from paper": type a sub\'s handwritten W-9 into the form\'s own boxes, attach a photo of the paper, and file it as signed on paper.',
    'The row ends up like a portal signing: the answers on the record, the compliance pill green, the sub\'s portal showing the form on file. The signature stays on the scan; nothing is signed for them.',
    'Required boxes left blank never stop you from filing; the record lists them so you can ask the sub for the rest. In a hurry, "Skip the boxes, just file the scan" keeps today\'s behaviour.',
    'Sensitive numbers are written into the PDF only, as on the signing page. Opening the filled PDF or the scan stays limited to devs, controllers, and pay-approved masters, and each open is logged.',
  ],
}

export default note
