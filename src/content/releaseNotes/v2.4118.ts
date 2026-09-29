import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4118',
  date: '2026-09-29',
  title: 'Submittals: a fixture counted as WC 1&2 can be split into WC-1 and WC-2',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'In Choose from the takeoff, a row whose name spells out more than one tag gets a Split switch. Off, one row as counted; on, a row per tag with the same product and house, and the bar says “1 split into 2”. Your split is remembered with your tick.',
    'On a draft, Split beside Edit does the same after the fact for any row whose tag lists several — from the takeoff, the schedule, or typed as “WC-1, WC-2”. Product, house, lead time and sheet pages carry to each row.',
    '“When can a row split?” under the pick list and the rows shows this bid’s own count names as the rule reads them: WC 1&2 can split; DWH1 & ET stays one row because “ET” has no number.',
    'The procurement log marks rows split from one count with “counted with WC-2 on the takeoff”, so nobody orders the count twice, and each row keeps its stage.',
  ],
}

export default note
