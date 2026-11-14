import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7208',
  date: '2026-11-13',
  title: 'Lien window: setting the last day of work updates the row behind it',
  kind: 'fix',
  highlights: [
    'When you set a job’s last day of work in its Lien window, the row behind the window now moves to its new dates right away. This holds on the Lien desk’s By date tab and on the Pipeline. It kept the old dates until the page was loaded again.',
    'Closing the window leaves the page where you were. Nothing scrolls and nothing reloads.',
    'Recording a notice, a filing or its service in the window now updates the row’s flags behind it too.',
    'A day set on the Lien desk’s own last-day line reaches the By date tab the same way.',
  ],
}

export default note
