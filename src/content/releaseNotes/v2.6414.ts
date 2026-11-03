import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6414',
  date: '2026-11-03',
  title: 'The signed hours statement through the dev MCP: read one, make one, send it, file it on a matter (punch list #212, PR 5)',
  kind: 'feature',
  highlights: [
    'A dev’s agent can now read a worker’s hours statement for a job and a span exactly as the Hours statement window draws it: the days by week with in, out, hours and note, the rate and amount, the pay lines, the gap before the app’s first clock day, and the statements already made, with one reading line first.',
    'It can make one the way the window does, planned first and applied against the same clock, with the dev named as the preparer, and send the signing link to the worker by email or take the link to hand on. The link never lands in the call log.',
    'It can put a signed statement’s PDF on a legal matter’s Evidence tab, as Add to evidence does on the Legal desk, so the firm reads it with the documents from the office.',
    'Every write goes through the dev seat’s plan then apply rule: a plan that no longer matches writes nothing, and a view as another role is refused.',
  ],
  roles: ['dev'],
}

export default note
