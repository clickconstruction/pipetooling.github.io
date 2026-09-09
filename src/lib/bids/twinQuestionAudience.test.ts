import { describe, expect, it } from 'vitest'

import {
  classifyTwinQuestionAudience,
  effectiveTwinQuestionAudience,
  isTwinQuestionAudience,
  twinQuestionAudienceColumnPresent,
} from '../../../supabase/functions/_shared/twinQuestionAudience'

// The live open queue on 2026-09-08 — the twelve questions Wendi read when she
// said "this robot is talking to you not me". Seven were for the operator.
const OPERATOR = [
  'This sandbox blocked the plan-substrate insert (bids_plan_substrates row) — no DB lane and the permission layer denied the sign-in capture script, so get_plan_brief will keep saying no substrate on b475 even though the extraction is done and stamped on the ledger. Can someone attach the substrate row from the note, or add a harness verb for it? Full substrate JSON is preserved in the run workspace.',
  'The sandbox running this backtest blocked the plan-substrate database insert (bids_plan_substrates row) - REST needs the public client apikey and the environment will not let me read or fetch it. Can someone either insert work/R2-BT-14/substrate.json for b474, or add a twin-mcp verb for substrate attach so future runs are not blocked?',
  'The sandbox running R2-BT-27 blocked the browser sign-in this session, so I could not attach my plan-read summary to the bid record (the substrate row). Can someone confirm the ledger note is enough for audit on this run?',
  'The plans file on this bid (Drive file 1r5HLMJHjH9VMl631JLOieo7styWub2Cd) is not shared with the plan-fetch service account, so I cannot open the set. Can you share that file with the service account or drop a copy in the bid folder so I can run the takeoff?',
  'The sandbox running this backtest blocked an insert into fixture_types (I tried to add an entry named for the school-district price adder). Two asks: (1) can someone add a book entry for a district/prevailing-wage price adder? (2) is spreading the adder across every row acceptable for audit?',
  'M5 stage 3 (labor) is blocked by the twin write fence: cost_estimate_labor_rows has no bid_id column, so digital_twin_write_fence_insert denies every labor-row insert on my own assigned bid — the app swallows the 403s silently.',
  'ANSWER PARKED for open question c507b268 (BT-8 San Pedro scope check): NO — b298 Take 5 6811 San Pedro did NOT include a site utility package.',
]

const ESTIMATOR = [
  'Can you attach the plumbing sheets for this SpaceX Level 1 fit-out so I can do the plumbing takeoff? The file on the bid right now is the electrical part.',
  'The plan file on this bid is the 2021 shell drawing set for The Offices at Rogers Road, Buildings 1 through 6. Can you attach the TSAOG interior fit-out drawing set so I price the right package?',
  '[audit b474 / footage · sheet P2.01] Your 4in sanitary is 50 ft, and the underfloor 4in main from the restrooms to the exit point scales at well over 100 ft. Do you only count the pipe you trace on the enlarged plan and leave the rest in the fixture money?',
  '[audit b474 / trim · sheet P4.01] You carried 7 TMV-2 mixing valves and I read 4 as base (SK-2, SK-3, two community sinks). Which sinks get the TMV-2?',
  'For a restroom and breakroom fit-out inside a big existing production building like SpaceX Bastrop, do you price the above-ground waste and vent at the flat PVC foot rate or at the loaded cast-iron rate, and the water at the PEX rate or copper?',
  'Do you count a bi-level drinking fountain like the Elkay EZSTL8WSLK as one fixture or two stations?',
  'Slate doctrine asks from the 2026-08-31 backtest slate (b424/b425/b426 — full detail in each bid\'s STG-6 stamp). Three decisions for Wendi/Stephen: (1) SMALL-TI RESIDUAL — all four fresh small runs came in LIGHT. Approve a footage residual (~$6-8k on sub-$50k jobs)? (2) TAKE 5 PROTO PACKAGE — approve minting a book entry? (3) HUNTER RD BAND — bank this as a market-band flag?',
  'P1.3 med gas plan: the oxygen runs are short and straight (~143 ft drawn). Do you still add extra footage for ups-and-downs on med gas copper? I carried about 286 ft of half-inch oxygen.',
]

describe('classifyTwinQuestionAudience', () => {
  it('sends the machine-side questions to the operator, with the signal named', () => {
    for (const q of OPERATOR) {
      const c = classifyTwinQuestionAudience(q)
      expect(c.audience, q.slice(0, 60)).toBe('operator')
      expect(c.signals.length, q.slice(0, 60)).toBeGreaterThan(0)
    }
  })

  it('leaves every job question with the estimator, no signals', () => {
    for (const q of ESTIMATOR) {
      const c = classifyTwinQuestionAudience(q)
      expect(c.audience, q.slice(0, 60)).toBe('estimator')
      expect(c.signals, q.slice(0, 60)).toEqual([])
    }
  })

  it('names the specific signals so a human can see why', () => {
    expect(classifyTwinQuestionAudience(OPERATOR[0]!).signals).toEqual(
      expect.arrayContaining(['sandbox', 'sign-in', 'substrate row', 'harness', 'run workspace', 'JSON', 'tool name', 'table name']),
    )
    expect(classifyTwinQuestionAudience(OPERATOR[6]!).signals).toEqual(['parked answer'])
    expect(classifyTwinQuestionAudience(OPERATOR[3]!).signals).toEqual(['service account'])
  })

  it('does not trip on fixture tags, sheet numbers, bid numbers or run codes', () => {
    for (const q of ['WC-1 x3 on sheet P2.01 for b474 (R2-BT-14)', 'SK-2, SK-3 and the TMV-2 on P4.01', 'FCO x4, oi-1 x1, wh-1 x3 vs two']) {
      expect(classifyTwinQuestionAudience(q).audience).toBe('estimator')
    }
  })
})

describe('effectiveTwinQuestionAudience', () => {
  it('trusts the column when it is present — a bounce beats the text', () => {
    expect(effectiveTwinQuestionAudience({ audience: 'estimator', question: OPERATOR[0]! })).toBe('estimator')
    expect(effectiveTwinQuestionAudience({ audience: 'operator', question: ESTIMATOR[0]! })).toBe('operator')
  })
  it('falls back to the text when the column is missing or junk', () => {
    expect(effectiveTwinQuestionAudience({ question: OPERATOR[0]! })).toBe('operator')
    expect(effectiveTwinQuestionAudience({ audience: null, question: ESTIMATOR[0]! })).toBe('estimator')
    expect(effectiveTwinQuestionAudience({ audience: 'owner', question: OPERATOR[5]! })).toBe('operator')
  })
})

describe('column presence + guard', () => {
  it('reports the column only when every row carries the key', () => {
    expect(twinQuestionAudienceColumnPresent([])).toBe(false)
    expect(twinQuestionAudienceColumnPresent([{ id: 'a', audience: 'estimator' }, { id: 'b', audience: null }])).toBe(true)
    expect(twinQuestionAudienceColumnPresent([{ id: 'a', audience: 'estimator' }, { id: 'b' }])).toBe(false)
  })
  it('isTwinQuestionAudience accepts only the two lanes', () => {
    expect(isTwinQuestionAudience('estimator')).toBe(true)
    expect(isTwinQuestionAudience('operator')).toBe(true)
    expect(isTwinQuestionAudience('owner')).toBe(false)
    expect(isTwinQuestionAudience(null)).toBe(false)
  })
})
