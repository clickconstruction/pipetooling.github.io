import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6116',
  date: '2026-10-30',
  title: 'The discount and a job’s Next label read in dark mode',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'],
  highlights: [
    'In dark mode the job form’s − Add discount and the Next label on a job’s schedule line in Stages were still a dark green on the dark card. Both now take the theme’s green, light on dark and unchanged in light mode.',
    'The discount’s other green words follow: the dollars a standing discount takes off, the hint under the job total, the % and the reason chips of a customer’s standing discount, and the share in the job summary’s discount fold.',
    'Nothing else about these lines changed.',
  ],
}

export default note
