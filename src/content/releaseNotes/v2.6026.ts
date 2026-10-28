import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6026',
  date: '2026-10-28',
  title: 'Settings: push me only at these hours',
  kind: 'feature',
  highlights: [
    'Push Notifications on Your account has a new block, Push me: Push me any time, or Push me only at these hours. Under the second, the days and the From and To times, the same controls as Office hours.',
    'The line under it reads your hours back, like Pushed Mon to Fri, 6:00 AM to 8:00 PM. A day you turn off is a day with no pushes, so weekends off is two presses.',
    'Picking Push me only at these hours saves every day, 6:00 AM to 8:00 PM, at once; Save my hours keeps your changes and Put them back undoes them. Push me any time clears your hours.',
    'Nothing holds a push yet. From the next update, a push outside your hours waits for you, and a customer’s reply still goes to the office at once.',
  ],
}

export default note
