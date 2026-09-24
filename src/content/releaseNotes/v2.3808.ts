import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3808',
  date: '2026-09-24',
  title: 'Looking back at an old week no longer fills it with Office blocks',
  kind: 'fix',
  highlights: [
    'The standing office schedule fills Office blocks for the week you are looking at. Until now that included weeks already worked: opening a week from last spring quietly wrote 8–4 Office blocks for the office roster onto days long past, in your name.',
    'The fill now stops at today. A past week makes no change at all; the current week fills from today onward; future weeks fill as before.',
    'Blocks that were filled into the past before this fix stay where they are — nothing is removed on its own. Ask if you want a list of them.',
  ],
}

export default note
