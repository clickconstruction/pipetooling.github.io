import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4898',
  date: '2026-10-08',
  title: 'GC mode: Follow up on quotes we are waiting for, for a dev',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A dev opens Follow up beside the Project Board on GC projects. It lists every company we are waiting on for a quote, with the ones to call first at the top.',
    'Log a contact saves a call, a text or an email on the ask, with the day they promised the quote by. A day that passes with no quote moves the card to Late on their word.',
    'Will not do it and Cannot do it ask why first. The reason stays with the job and with the company.',
    'Each project’s trades also list the companies asked and where each stands.',
  ],
}

export default note
