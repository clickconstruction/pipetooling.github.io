import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2910',
  date: '2026-09-05',
  title: 'Hiring users land on Hiring, "Add to roster" lives on the Hire card, and office roster kinds',
  kind: 'fix',
  highlights: [
    'Opening Prospects from the menu lands you on the Hiring board when that is the pipeline you hold — no more arriving on a live prospect card with a timer running. If you work both pipelines, Prospects reopens on whichever one you used last.',
    'Every Hire card now has an Add to roster button, so the roster prompt that opens when someone is hired can be reopened any time. The roster kind is pre-selected from the role column, and the list now includes Office / assistant, Estimator, Superintendent, Primary and Master technician alongside Subcontractor and Helper.',
    'The Team review reminder, the review cadence setting and the Person Desk all name the same place — Hiring → Review — instead of the old "Team → Review". The Hire stage also stops showing "No onboarding items defined yet" to people who cannot define them; the dev still sees it with the pointer to Onboarding settings.',
    'For estimators, the Customers list says "money not shown for estimators" instead of showing $0 paid / billed / unbilled — those figures were never readable for that role.',
  ],
}

export default note
