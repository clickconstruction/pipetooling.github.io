import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3535',
  date: '2026-09-16',
  title: 'Pipeline: three of its confirm dialogs move into their own files',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. The Ready to Bill checklist, the plain "Are you sure?" send-back and the Move to Collections confirm now live in their own components with tests; what each one does when you press Confirm is unchanged.',
  ],
}

export default note
