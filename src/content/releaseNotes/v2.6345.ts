import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6345',
  date: '2026-11-02',
  title: 'Every set of plans gets its own Drive folder, the crew’s as-built takes photos or a PDF, and a mail’s file follows its paper',
  kind: 'feature',
  highlights: [
    'A set or an as-built added on a job with no link gets its own folder under the job’s Plans folder in Drive, named after the set, and the set’s link points at it. Open ↗ on the set, Open plans on the Job tab and the site’s Plans look all open the same folder.',
    'Add our as-built on a job’s Documents tab gains Photos or a PDF: take photos of the marked sheets on the phone, or pick a PDF, and they land in the as-built’s folder one by one, named by the job and the day. The press says how many go, a file over 10 MB or of another kind stays with its reason, and the rest still go. Each photo adds to the list, so the phone’s camera can take them one at a time.',
    'A file that did not land stays on the screen with its reason and a press to file it again, into the same as-built or paper. Add photos or a PDF on an as-built takes more files later, and Make its folder gives a set with no link its folder once the job has one.',
    'Keep this mail as a paper in My Mail now files the mail’s attachments into the paper’s folder, not just a link.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'helpers', 'subcontractor', 'superintendent'],
}

export default note
