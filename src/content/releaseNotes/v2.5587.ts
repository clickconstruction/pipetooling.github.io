import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5587',
  date: '2026-10-16',
  title: 'The tech’s bio: the office writes it on the desk, the tech picks the lines in Settings',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'helpers'],
  highlights: [
    'A tech’s bio is the short resume a customer gets with the tech’s first On my way text: years in the trade, the license, what they are best at, a personal line. The office writes it on the person’s desk under People → Users → Open desk, one line at a time, with six prompts shaped like a resume and the Spanish beside each line.',
    'The desk shows the bio as a customer gets it, opened with A little about and the tech’s first name, and counts the whole against 320 characters, two text messages. A line past the cap is refused before it saves.',
    'Settings → Your account gains Your bio for primaries, helpers and the office: the lines the office wrote, each with a Say it / Don’t say this switch. A line turned off leaves the bio, and the desk shows the office who turned it off.',
    'The text itself follows in the next release today: the bio rides as a second text right after a tech’s first On my way to a customer, and never to that customer again.',
  ],
}

export default note
