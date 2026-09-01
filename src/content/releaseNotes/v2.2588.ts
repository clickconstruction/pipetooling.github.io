import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2588',
  date: '2026-09-01',
  title: 'Release window shows what was already issued',
  kind: 'feature',
  highlights: [
    'The Release of Lien window now lists every release already issued on the job — with View and Void — so billed jobs (which have no Bill Customer button) can manage their releases too.',
    'The Dashboard nudge for cleared conditional releases now points at the release button on the job row, which works from every Pipeline section.',
  ],
}

export default note
