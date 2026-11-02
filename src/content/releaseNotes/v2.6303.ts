import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6303',
  date: '2026-11-01',
  title: 'Documents tab: Add a file to a job’s Drive folder from the app',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On the job window’s Documents tab, each folder under Job folders has an Add a file press. Pick a file from your computer and the app puts it in that folder in Drive, with no Drive window.',
    'Job folder is the job’s own folder, Plans is for drawings and anything trades should see, and Pictures is Customer Pictures with the job’s photos. The panel says where the file goes before you press.',
    'The press names the folder, Add it to Plans, and the line afterwards says the file is there with Open in Drive. A file over 10 MB is told so, and a refusal shows its reason.',
  ],
}

export default note
