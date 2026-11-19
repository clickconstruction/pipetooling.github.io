import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7920',
  date: '2026-11-19',
  title: 'Paint a map lists the jobs you changed and the jobs coming up',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'estimator', 'superintendent', 'subcontractor', 'helpers'],
  highlights: [
    'Your last jobs now counts the jobs you changed in the app. Work at a desk and the list fills with the jobs you took a payment on, moved or edited, each marked changed with its day.',
    'Which job is it for? has a new list, Coming up: up to four jobs on your schedule in the next two weeks, soonest first. Paint the way in the day before the crew arrives.',
    'The company’s office job is no longer offered, and Paint a map no longer opens on it. The search still finds it.',
    'Paint a map opens on your last job only when you were there in the last two weeks. With an older last job it asks, with that job in the list.',
  ],
}

export default note
