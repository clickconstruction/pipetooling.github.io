import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6726',
  date: '2026-11-08',
  title: 'Legal desk: the proceedings beside the claim, and the firm reads them',
  kind: 'feature',
  highlights: [
    'The Account tab of a matter now carries Beside the claim, under People on the matter: the proceedings that run alongside the collections claim. An agency complaint, a records request, a bond claim or a permit question each gets a row with its agency, its reference number, a contact picked from the matter’s people, where it stands (open, answered or closed, with the day) and the Evidence documents behind it.',
    'Press ＋ Add a proceeding to add one, Edit to change it, Remove the proceeding… to take it off; a removed row stays on the record. Tick Keep its documents out of settlement letters and the Evidence rows it names wear a kept out chip, and the claim table’s document picker leaves them out, so a paper behind an agency complaint never rides into a letter to the other side.',
    'The firm reads the list on its portal’s Account tab under Property record: the kind and name, the agency and reference, the contact’s name and role, where it stands, and the documents as links when they travelled. The office’s note on a proceeding stays home. Mark attorney ready’s preview draws the same list.',
  ],
}

export default note
