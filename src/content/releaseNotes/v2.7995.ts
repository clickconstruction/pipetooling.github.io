import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7995',
  date: '2026-11-19',
  title: 'Papers: send a paper to a customer, a supply house or someone on no list',
  kind: 'feature',
  highlights: [
    'Send a paper now asks Who is it with? It finds your team, your subs, a customer, a supply house and the people on file at each.',
    'Someone not in any list is the last row. Type their name, their email and their company, and the paper goes out.',
    'The window shows what the paper will say, such as Lena Park, Branch manager, signing for Tallgrass Supply Co.',
    'These papers sit under a new chip on Agreements, Outside companies, and each line says who signs.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
