import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6366',
  date: '2026-11-02',
  title: 'Materials on site: print a manifest to laminate and hang on each cage and box',
  kind: 'feature',
  highlights: [
    'On Jobs → Materials, a job’s page has Print the manifest beside Print labels. Pick every box or some of them. The press names its count, such as Print 4 manifests.',
    'Each box prints on its own Letter page in large plain type: the stencil, the job and the site, the day the manifest was printed, and the day something was last recorded in the box.',
    'Under the dates the page lists what is in the box with each number as the app has it. Ruled lines at the foot take what is added on site by hand, with the quantity, who and the day.',
    'On the phone, a box’s screen has Print the manifest for that box under its parts. It opens the office page on that one box.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent', 'primary', 'helpers'],
}

export default note
