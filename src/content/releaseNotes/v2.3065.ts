import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3065',
  date: '2026-09-07',
  title: 'Subs boards and the Sub Labor ledger use the sheet’s job link',
  kind: 'fix',
  highlights: [
    'Jobs → Subs → Work, the sheets-needing-a-work-order list, the Sub Labor ledger (job names, search, the rail), Crew P&L and the sheet form all put a sheet on its job by the link on the sheet, not by comparing job numbers as text.',
    'Quickfill → Jobs Cleanup counts a sheet as unlinked only when it has no job link.',
  ],
}

export default note
