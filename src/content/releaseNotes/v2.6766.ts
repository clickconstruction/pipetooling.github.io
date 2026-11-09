import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6766',
  date: '2026-11-08',
  title: 'Typed confirms on the sweeps: the controller retires draft bills, the owner links jobs to their bids, estimators clean the catalog',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller', 'estimator'],
  highlights: [
    'The controller retires a draft bill on a paid job from Settings → Data & recovery. The window asks for the job’s number first.',
    'The owner links jobs to their bids from the same tab. Link all asks for the number of matches.',
    'Estimators open Duplicate materials and delete part and assembly types on Bids & materials. Each asks for the name, or the count for Remove all unused.',
    'The search box now finds Crew P&L, the Bridge and Templates for the owner.',
  ],
}

export default note
