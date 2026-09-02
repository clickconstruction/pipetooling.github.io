import type { SubPortalPayload } from './subPortalPayload'

/**
 * DEV-only fixture behind /sub?demo=1 (and the page's render smoke): the
 * approved sub-portal mock's exact numbers, so visual checks against the
 * design have a stable target. Never served in production — the page gates
 * on import.meta.env.DEV.
 */
export const SUB_PORTAL_DEMO_PAYLOAD: SubPortalPayload = {
  company: {
    name: 'Click Plumbing and Electrical',
    cityLine: 'Your reliable team is just a click away',
    licenseLine: '',
    phone: '(512) 360-0599',
    email: '',
  },
  subName: 'Danny Vasquez',
  preparedOn: '2026-09-02',
  sheets: [
    {
      id: 'demo-s1',
      jobNumber: 'J-1482',
      address: '1208 Brazos St',
      status: 'in_progress',
      items: [
        { label: '14 × Top out fixtures — 3.5 hr each @ $58/hr', amount: 2842 },
        { label: 'Water heater set (fixed price)', amount: 278 },
      ],
      agreed: 3120,
      paid: 1500,
      backcharges: 0,
      open: 1620,
      payableAfter: '2026-09-04',
      payHoldReason: 'Top out passed inspection Aug 29 — queued for the Friday pay run (Sep 4).',
    },
    {
      id: 'demo-s2',
      jobNumber: 'J-1477',
      address: '894 Lamar Blvd',
      status: 'complete',
      items: [
        { label: '18 × Trim set fixtures — 2.4 hr each @ $58/hr', amount: 2505.6 },
        { label: 'Final walk & punch (fixed price)', amount: 54.4 },
      ],
      agreed: 2560,
      paid: 0,
      backcharges: 0,
      open: 2560,
      payableAfter: '2026-09-09',
      payHoldReason: "Builder's walk-through — scheduled Sep 9. We pay you as soon as the work is accepted.",
    },
  ],
  payments: [
    { date: '2026-08-22', jobNumber: 'J-1482', memo: 'Progress payment — rough passed', amount: 1500 },
    { date: '2026-08-15', jobNumber: 'J-1463', memo: 'Final payment', amount: 3940 },
    { date: '2026-08-15', jobNumber: 'J-1463', memo: 'Restock: cracked lav (supply house)', amount: -180 },
    { date: '2026-08-01', jobNumber: 'J-1455', memo: 'Final payment', amount: 5120 },
  ],
  totals: { earned: 44810, paid: 40630, open: 4180 },
  offers: [
    {
      id: 'demo-o1',
      title: 'Rough-in · 407 E 6th St',
      lines: [
        { label: 'Rough-in — 22 fixtures per plan sheet P-2', amount: 4350 },
        { label: 'Water/gas stub-outs, garage', amount: 500 },
      ],
      total: 4850,
      startsLabel: 'Starts week of Sep 15 · about 6 working days',
      expiresOn: '2026-09-12',
    },
  ],
  documents: [
    {
      id: 'demo-d1',
      name: 'Master Subcontract Agreement',
      state: 'on_file',
      detail: { kind: 'signed', signedOn: '2026-09-02' },
      signable: false,
    },
    { id: 'demo-d2', name: 'W-9', state: 'on_file', detail: { kind: 'on_file' }, signable: false },
    {
      id: 'demo-d3',
      name: 'Insurance certificate (COI)',
      state: 'expiring',
      detail: { kind: 'expires', on: '2026-11-30' },
      signable: false,
    },
    {
      id: 'demo-d4',
      name: "Workers' comp waiver",
      state: 'action_needed',
      detail: { kind: 'needs_signature' },
      signable: true,
    },
  ],
  payRun: {
    day: 'friday',
    nextRun: '2026-09-04',
    explainer:
      "We run payments every Friday. When your work passes inspection it's queued for the next run. Final payments on builder jobs release once the builder accepts the work — this page always shows exactly where each dollar stands.",
  },
  requestToken: null,
  slug: 'dv-mechanical',
}
