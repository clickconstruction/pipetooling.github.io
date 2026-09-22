import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3701',
  date: '2026-09-21',
  title: 'Hire someone in one form: the login, the roster row, pay, the workday and the paperwork, in order',
  kind: 'feature',
  highlights: [
    'People → Users → + Hire: name, kind, email, start date, wage or salaried workday, and an optional paperwork packet — pressed once, run as an ordered list with a result per step and Retry on the one that failed.',
    'An invite now creates the roster row with the login, linked from birth, and carries the start date — "two identities until linked" stops being a state a person can be in. Sample and twin accounts get no roster row.',
    'A pay row with no wage cannot be saved from Hire, so the empty salaried row that put phantom hours into every payroll total cannot come back through this door.',
    'Guide: hire someone.',
  ],
}

export default note
