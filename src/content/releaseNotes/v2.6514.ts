import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6514',
  date: '2026-11-04',
  title: 'Adding someone to the roster makes them a person who can hold hours and a Charged as, with or without a login',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Add to roster, Hire with no email, the Hiring board’s Add to roster, the step form, the sub sheet, the work order and Banking’s pickers now make the whole person in one step. They can hold clock sessions, a Charged as and a workday template from that day, and a login can be attached later without moving anything.',
    'On People → Users the login chip says whether someone can sign in. A person added with no login reads no login until one is attached, and Imitate is offered only for a login.',
    'A salaried hire no longer needs a login for the workday template: the template belongs to the person.',
    'The guide for adding someone to the roster says what a person with no login can hold.',
  ],
}

export default note
