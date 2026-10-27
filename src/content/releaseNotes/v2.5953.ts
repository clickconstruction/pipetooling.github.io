import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5953',
  date: '2026-10-26',
  title: 'Empty lists on Jobs name the next press',
  kind: 'feature',
  highlights: [
    'Jobs → Stages: an empty group now reads Nothing in Working needs you. A search that hides a group quotes it and offers Clear the search. On a phone, Needs me and Today offer All when they hide every row.',
    'Inspections, Report templates, Crew P&L, the Sub Labor ledger and the Team week each name their own button when empty, like Add Inspection, Edit Portals, Add template, All time, New Sub Labor or Previous week.',
    'In the job window, the Documents tab names the Bill tab, the Contract window, the Lien window and Test report. Job detail names Edit job and Schedule…, and the activity feed offers Add a note.',
    'Searches in the deposit list, Find a check, the share windows, the crew picker and the data health window quote what you typed and offer Clear the search. Lists where empty is good say so, like Nothing to send or Nothing waiting on a GC.',
  ],
}

export default note
