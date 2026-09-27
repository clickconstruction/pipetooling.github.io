import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3878',
  date: '2026-09-27',
  title: 'Pipeline: the lien icon says the timeline is behind it',
  kind: 'fix',
  highlights: [
    'On a Billed or Collections row, the orange lien icon’s tooltip now says what opens: the Lien window with the job’s timeline (whose move it is), the demand letter and the lien papers. While a letter is out it says the timeline shows how long they have.',
    'On a phone card the menu item reads “Lien window · timeline” instead of “Lien Tooling”.',
  ],
}

export default note
