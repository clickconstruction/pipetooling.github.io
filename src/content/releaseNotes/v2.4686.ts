import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4686',
  date: '2026-10-06',
  title: 'Counts: a second import is reviewed against the sheet, not piled on top of it',
  kind: 'feature',
  highlights: [
    'Import from /Tooling onto a bid that already has counts now opens a review instead of adding every line again. Rows with the same name and group that changed count or page offer an Update. Rows only in the copy offer an Add. Rows only on the bid offer Remove or Keep. Rows that match exactly fold away.',
    'Update keeps every part and price attached to the row, and each line says so. Remove drops them, and the line says that in red before you press Apply. A row that left and a row that arrived with the same count are offered as one row renamed or moved, so its pricing follows the new name.',
    'A copy of every sheet starts Missing on Remove all, because a row CountTooling no longer has was deleted on purpose. A This Canvas Only copy or a hand-typed paste starts on Keep all. Each bucket has one switch, and every row has its own tick.',
    'The first import onto an empty bid is unchanged, one click. Copying again with nothing changed now says so and writes nothing. Undo after Apply puts the old values back, removes what was added and restores what was removed.',
  ],
}

export default note
