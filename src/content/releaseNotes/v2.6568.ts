import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6568',
  date: '2026-11-06',
  title: 'The dev seat files mail where it belongs: a file off a mail onto a job, a person or a matter, and a whole conversation onto a job’s Activity and notes',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A dev’s agent can take a named file straight off a mail it found and put it where it belongs: the job’s Drive folder as Add a file does, a person’s HR file as evidence, or a legal matter’s Evidence tab. The bytes are read on the server and never pass through the agent.',
    'It can also tag a whole conversation out of any login’s box onto a job, through the same planner the My email tag press uses, so every mail lands on Activity and notes at its own time, nothing is written twice, and later mail follows by itself. The plan lists each mail and what it becomes before anything lands.',
    'A Claude Code session in the repo has the method as /mail-search: the narrowest query first, read a hit only when the snippet does not settle it, say where a file goes before the plan, file once.',
  ],
}

export default note
