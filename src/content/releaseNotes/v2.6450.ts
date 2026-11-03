import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6450',
  date: '2026-11-03',
  title: 'Signed hours statements are for controllers and devs alone (punch list #212)',
  kind: 'fix',
  highlights: [
    'A signed hours statement is payroll data, so the Hours statements section on a job’s Documents tab and on a person’s desk now shows to a dev and the controller only. A pay-approved leader and an assistant no longer see it or make one.',
    'The section wears a small Controllers and devs only tag beside its heading, so an office reader knows why a colleague cannot see it.',
    'The table holds the same line for every path, including the dev MCP, and a signed statement’s PDF opens for those two roles alone.',
    'The pay switch is on for whoever sees the window; the words about an assistant’s switch staying off are gone with the rule.',
  ],
  roles: ['dev', 'controller'],
}

export default note
