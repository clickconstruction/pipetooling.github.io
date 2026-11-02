import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6301',
  date: '2026-11-01',
  title: 'Pipeline rows: a Job folder icon opens the job’s Documents tab',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Every Pipeline row’s icon block under Edit now has a folder icon. Press it and the job window opens on its Documents tab, where the job’s folders are listed with Open in Drive beside each.',
    'Hold ⌘ (Ctrl on Windows) and press the icon to open the job’s folder in Drive itself.',
    'The icon is amber when the job has a Drive folder and grey when it does not yet. The grey icon still opens the tab, which says when the folder is made.',
    'On the phone cards, the ⋯ sheet has a Job folder line in the same place, marked not made yet while the folder is missing.',
  ],
}

export default note
