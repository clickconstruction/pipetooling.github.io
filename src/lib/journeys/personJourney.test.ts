import { describe, expect, it } from 'vitest'
import {
  buildPersonJourney,
  customerJourney,
  customerRowsForJob,
  dayWord,
  daysBetween,
  firmJourney,
  houseJourney,
  jobLabel,
  subJourney,
  type CustomerRows,
  type JobContractRow,
} from './personJourney'
import { customerJourneys } from '../customerJourneys'

const NOW = new Date('2026-09-16T15:00:00Z')

function emptyCustomer(): CustomerRows {
  return {
    jobs: [],
    estimates: [],
    estimateEvents: [],
    contracts: [],
    invoices: [],
    hazmat: [],
    portalLinks: [],
    portalSlug: null,
    portalOpens: null,
    bidRooms: [],
    bidRoomEvents: [],
    submittalRooms: [],
    submittalEvents: [],
    testReports: [],
    gcStatements: [],
    demandLetters: [],
    lienFilings: [],
    lienReleases: [],
  }
}

function contract(over: Partial<JobContractRow>): JobContractRow {
  return {
    id: 'c1',
    job_id: 'j363',
    revision: 1,
    status: 'sent',
    sent_at: null,
    last_sent_at: null,
    send_count: 1,
    reminder_count: 0,
    first_viewed_at: null,
    view_count: 0,
    signed_at: null,
    signer_mode: null,
    paper_signed_on: null,
    voided_at: null,
    public_token: 'tok-1',
    ...over,
  }
}

const palmer = { kind: 'customer' as const, id: 'cust-palmer', name: 'Michael Palmer' }

describe('personJourney — a real person on the strips', () => {
  it('a brand-new customer: every homeowner step reads not-yet with a door, and no GC strip', () => {
    const j = customerJourney(palmer, emptyCustomer(), NOW)
    expect(j.journeys).toEqual(['homeowner'])
    expect(j.steps['estimate-email']).toMatchObject({ state: 'never', headline: 'No estimate yet', action: { to: '/estimates' } })
    expect(j.steps['job-contract-email']).toMatchObject({ state: 'never', action: { label: 'Start the sweep', to: '/jobs?tab=pipeline' } })
    expect(j.steps['customer-portal']).toMatchObject({ state: 'never', headline: 'No portal link yet', action: { to: '/customers/cust-palmer' } })
    expect(j.steps['bill-email']?.state).toBe('never')
    expect(j.steps['demand-letter']?.state).toBe('na')
    expect(j.summary).toBe('customer · 0 jobs · no portal link')
    // every homeowner step in the journeys data has an answer
    const home = customerJourneys().find((x) => x.id === 'homeowner')!
    for (const s of home.steps) expect(j.steps[s.id], s.id).toBeDefined()
  })

  it("J363's agreement story: rev 3 sent and never opened, rev 4 signed on paper — the signed one wins, the voids are history", () => {
    const rows = emptyCustomer()
    rows.jobs = [{ id: 'j363', hcp_number: '363', click_number: null, job_name: 'Palmer', status: 'working', customer_id: palmer.id, gc_customer_id: null }]
    rows.contracts = [
      contract({ id: 'r1', revision: 1, sent_at: '2026-09-03T14:00:00Z', first_viewed_at: '2026-09-03T15:00:00Z', view_count: 1, voided_at: '2026-09-03T16:00:00Z' }),
      contract({ id: 'r2', revision: 2, sent_at: '2026-09-03T16:10:00Z', voided_at: '2026-09-03T17:00:00Z' }),
      contract({ id: 'r3', revision: 3, sent_at: '2026-09-03T17:10:00Z', voided_at: '2026-09-04T09:00:00Z' }),
      contract({ id: 'r4', revision: 4, status: 'signed', sent_at: null, signer_mode: 'paper', paper_signed_on: '2026-09-04', signed_at: '2026-09-04T18:00:00Z', public_token: 'tok-4' }),
    ]
    const j = customerJourney(palmer, rows, NOW)
    expect(j.steps['job-contract-page']).toMatchObject({ state: 'signed', headline: 'Signed on paper Sep 4', link: '/contract/sign?t=tok-4' })
    expect(j.steps['job-contract-page']?.detail).toContain('3 earlier revisions voided')
    expect(j.steps['job-contract-email']).toMatchObject({ state: 'signed', headline: 'Signed on paper, never emailed' })
    expect(j.steps['job-contract-signed']).toMatchObject({ state: 'signed', headline: 'Filed from paper', action: { to: '/jobs?jobDetail=j363' } })
    expect(j.steps['job-contract-reminder']?.state).toBe('na')
  })

  it("the app's coverage rule wins: a voided row is no contract even if it carried a signature — but the card says so (the real J363)", () => {
    const rows = emptyCustomer()
    rows.jobs = [{ id: 'j363', hcp_number: '363', click_number: null, job_name: 'Palmer', status: 'working', customer_id: palmer.id, gc_customer_id: null }]
    rows.contracts = [
      contract({ id: 'r1', revision: 1, sent_at: '2026-09-03T14:00:00Z', voided_at: '2026-09-03T16:00:00Z' }),
      contract({ id: 'r4', revision: 4, status: 'voided', sent_at: null, signer_mode: 'paper', paper_signed_on: '2026-09-04', signed_at: '2026-09-04T18:00:00Z', voided_at: '2026-09-04T18:30:00Z' }),
    ]
    const j = customerJourney(palmer, rows, NOW)
    expect(j.steps['job-contract-email']).toMatchObject({ state: 'never', headline: 'Never sent — 2 revisions voided, one of them signed on paper Sep 4', action: { label: 'Start the sweep' } })
    expect(j.steps['job-contract-page']?.state).toBe('never')
  })

  it('an agreement sent and never opened waits with an Edit & re-send door; opened-not-signed reads opened', () => {
    const rows = emptyCustomer()
    rows.jobs = [{ id: 'j1', hcp_number: '900', click_number: null, job_name: null, status: 'working', customer_id: palmer.id, gc_customer_id: null }]
    rows.contracts = [contract({ job_id: 'j1', sent_at: '2026-09-06T12:00:00Z', send_count: 2, reminder_count: 1 })]
    let j = customerJourney(palmer, rows, NOW)
    expect(j.steps['job-contract-page']).toMatchObject({ state: 'sent', headline: 'Waiting 10 days · never opened', action: { label: 'Edit & re-send', to: '/jobs?jobDetail=j1' } })
    expect(j.steps['job-contract-page']?.detail).toBe('J900 · rev 1 · sent 2 times')
    expect(j.steps['job-contract-reminder']).toMatchObject({ state: 'sent', headline: '1 reminder sent' })
    rows.contracts = [contract({ job_id: 'j1', sent_at: '2026-09-06T12:00:00Z', first_viewed_at: '2026-09-07T12:00:00Z', view_count: 3 })]
    j = customerJourney(palmer, rows, NOW)
    expect(j.steps['job-contract-page']).toMatchObject({ state: 'opened', headline: 'Opened Sep 7 · 3 views · not signed' })
    expect(j.steps['job-contract-email']?.action).toBeNull()
  })

  it('the estimate lane reads opens from the events table and signature from the acceptor stamp; hash-only links become a Resend door', () => {
    const rows = emptyCustomer()
    rows.estimates = [{ id: 'e1', estimate_number: '1042', status: 'sent', sent_at: '2026-07-29T14:00:00Z', acceptor_consented_at: null, updated_at: '2026-07-29T14:00:00Z' }]
    let j = customerJourney(palmer, rows, NOW)
    expect(j.steps['estimate-email']).toMatchObject({ state: 'sent', headline: 'Sent Jul 29 · not opened', link: null, action: { label: 'Resend the link', to: '/estimates/e1' } })
    expect(j.steps['estimate-page']).toMatchObject({ state: 'sent', headline: 'Waiting — not opened' })
    rows.estimateEvents = [
      { estimate_id: 'e1', event_type: 'public_link_view', occurred_at: '2026-07-29T15:00:00Z' },
      { estimate_id: 'e1', event_type: 'option_viewed', occurred_at: '2026-07-30T09:00:00Z' },
    ]
    j = customerJourney(palmer, rows, NOW)
    expect(j.steps['estimate-email']).toMatchObject({ state: 'opened', headline: 'Sent Jul 29 · opened Jul 30', detail: '#1042 · 2 opens' })
    rows.estimates[0]!.status = 'customer_accepted'
    rows.estimates[0]!.acceptor_consented_at = '2026-07-30T10:00:00Z'
    j = customerJourney(palmer, rows, NOW)
    expect(j.steps['estimate-page']).toMatchObject({ state: 'signed', headline: 'Signed Jul 30' })
    expect(j.steps['estimate-thankyou']?.state).toBe('signed')
    expect(j.steps['estimate-terms']?.state).toBe('na')
  })

  it('bills: an open Stripe bill reads unpaid with the hosted link and an AR door; all paid reads paid; 45+ days makes the demand letter eligible', () => {
    const rows = emptyCustomer()
    rows.jobs = [{ id: 'j1', hcp_number: '1', click_number: null, job_name: null, status: 'billed', customer_id: palmer.id, gc_customer_id: null }]
    rows.invoices = [
      { id: 'i1', job_id: 'j1', status: 'billed', stripe_invoice_id: 'in_1', stripe_invoice_status: 'open', sent_to_customer_at: '2026-08-07T12:00:00Z', external_send_channel: null, hosted_invoice_url: 'https://invoice.stripe.com/x', amount: 15700 },
      { id: 'i2', job_id: 'j1', status: 'paid', stripe_invoice_id: 'in_2', stripe_invoice_status: 'paid', sent_to_customer_at: '2026-06-01T12:00:00Z', external_send_channel: null, hosted_invoice_url: 'https://invoice.stripe.com/y', amount: 500 },
    ]
    let j = customerJourney(palmer, rows, NOW)
    expect(j.steps['bill-email']).toMatchObject({ state: 'sent', headline: 'Sent Aug 7 · unpaid 40 days', detail: '1 open bill · 1 paid', link: 'https://invoice.stripe.com/x', action: { to: '/accounts-receivable' } })
    expect(j.steps['demand-letter']?.state).toBe('na')
    rows.invoices[0]!.sent_to_customer_at = '2026-07-20T12:00:00Z'
    j = customerJourney(palmer, rows, NOW)
    expect(j.steps['demand-letter']).toMatchObject({ state: 'never', headline: 'Eligible — a bill is 45+ days past', action: { to: '/jobs?jobDetail=j1' } })
    rows.invoices[0]!.stripe_invoice_status = 'paid'
    j = customerJourney(palmer, rows, NOW)
    expect(j.steps['bill-email']).toMatchObject({ state: 'paid', detail: '2 bills paid' })
    rows.invoices.push({ id: 'i3', job_id: 'j1', status: 'billed', stripe_invoice_id: null, stripe_invoice_status: null, sent_to_customer_at: '2026-09-01T12:00:00Z', external_send_channel: 'physical', hosted_invoice_url: null, amount: 200 })
    j = customerJourney(palmer, rows, NOW)
    expect(j.steps['bill-by-email']).toMatchObject({ state: 'sent', headline: 'Sent Sep 1', detail: '1 bill' })
  })

  it('the portal: a slug makes the short link; opens come from the office view stats; no link offers the share door', () => {
    const rows = emptyCustomer()
    rows.portalLinks = [{ audience: 'all', token: 'ptok', revoked_at: null, created_at: '2026-08-01T00:00:00Z' }]
    let j = customerJourney(palmer, rows, NOW)
    expect(j.steps['customer-portal']).toMatchObject({ state: 'sent', headline: 'Link exists · never visited', link: '/portal?t=ptok', action: { label: 'Copy the link' } })
    rows.portalSlug = 'michael-palmer'
    rows.portalOpens = { opens: 3, lastOpenedAt: '2026-09-03T12:00:00Z' }
    j = customerJourney(palmer, rows, NOW)
    expect(j.steps['customer-portal']).toMatchObject({ state: 'opened', headline: 'Visited 3 times · last Sep 3', link: 'https://my.clickplumbing.com/michael-palmer', action: null })
    expect(j.summary).toContain('portal visited')
    rows.portalLinks[0]!.revoked_at = '2026-09-10T00:00:00Z'
    rows.portalSlug = null
    j = customerJourney(palmer, rows, NOW)
    expect(j.steps['customer-portal']?.state).toBe('never')
  })

  it('a builder gets the GC strip: bid room from its events, submittals, test reports, statements, the owner notice', () => {
    const gc = { kind: 'customer' as const, id: 'gc-summit', name: 'Summit GC' }
    const rows = emptyCustomer()
    rows.jobs = [{ id: 'j804', hcp_number: '804', click_number: null, job_name: 'Auto Zone', status: 'working', customer_id: 'owner-1', gc_customer_id: 'gc-summit' }]
    rows.bidRooms = [{ id: 'room1', bid_id: 'b1', public_token: 'rtok', recipient_email: 'pm@summit.example', created_at: '2026-08-01T00:00:00Z' }]
    rows.bidRoomEvents = [
      { room_id: 'room1', event_type: 'link_sent', occurred_at: '2026-08-01T10:00:00Z' },
      { room_id: 'room1', event_type: 'room_view', occurred_at: '2026-08-02T10:00:00Z' },
      { room_id: 'room1', event_type: 'signed', occurred_at: '2026-08-05T10:00:00Z' },
    ]
    rows.submittalRooms = [{ id: 's1', bid_id: 'b1', token: 'stok', shared_at: '2026-08-10T10:00:00Z', status: 'open' }]
    rows.submittalEvents = [{ room_id: 's1', event_type: 'view', occurred_at: '2026-08-11T10:00:00Z' }]
    rows.testReports = [{ id: 't1', job_id: 'j804', sent_at: '2026-09-01T10:00:00Z', status: 'sent', test_type: 'hydrostatic' }]
    rows.gcStatements = [{ sent_at: '2026-09-02T10:00:00Z', total: 151979, sent_to: 'ap@summit.example' }]
    rows.lienFilings = [{ job_id: 'j804', kind: 'notice_53_056', filed_at: '2026-09-15T10:00:00Z', served_at: null, sends: [], voided_at: null }]
    const j = customerJourney(gc, rows, NOW)
    expect(j.journeys).toEqual(['homeowner', 'gc'])
    expect(j.steps['bid-room-email']).toMatchObject({ state: 'opened', headline: 'Sent Aug 1 · opened Aug 2', link: '/bid-room?t=rtok' })
    expect(j.steps['bid-room']).toMatchObject({ state: 'signed', headline: 'Signed Aug 5' })
    expect(j.steps['bid-room-signed']?.state).toBe('signed')
    expect(j.steps['submittal-room']).toMatchObject({ state: 'opened', headline: 'Shared Aug 10 · opened Aug 11', link: '/submittal?t=stok' })
    expect(j.steps['submittal-decided']?.state).toBe('never')
    expect(j.steps['test-report-email']).toMatchObject({ state: 'sent', headline: 'Sent Sep 1', detail: '1 report · hydrostatic' })
    expect(j.steps['gc-statement-email']).toMatchObject({ state: 'sent', detail: '1 statement · $151,979' })
    expect(j.steps['owner-notice']).toMatchObject({ state: 'sent', headline: 'Sent Sep 15', detail: '1 notice' })
    expect(j.steps['pricing-package-email']?.state).toBe('na')
    expect(j.summary.startsWith('builder')).toBe(true)
  })

  it('a sub: portal from the slug and the visits summary; the contract from the person document', () => {
    const s = { kind: 'sub' as const, id: 'p1', name: "Sam's Plumbing" }
    let j = subJourney(s, { portalLinks: [], portalSlug: null, visits: null, contracts: [] }, NOW)
    expect(j.steps['sub-portal-text']).toMatchObject({ state: 'never', action: { to: '/people?tab=subs' } })
    expect(j.steps['sub-contract-email']?.state).toBe('never')
    j = subJourney(
      s,
      {
        portalLinks: [{ token: 'stok', revoked_at: null, created_at: '2026-08-01T00:00:00Z' }],
        portalSlug: 'sams-plumbing',
        visits: { outsideCount: 12, lastOutsideAt: '2026-09-15T12:00:00Z' },
        contracts: [{ id: 'd1', document_name: 'Subcontractor agreement', status: 'sent', sent_at: '2026-08-02T12:00:00Z', signer_last_viewed_at: '2026-08-02T13:00:00Z', signed_at: null, expires_at: null }],
      },
      NOW,
    )
    expect(j.steps['sub-portal']).toMatchObject({ state: 'opened', headline: 'Visited 12 times · last Sep 15', link: 'https://my.clickplumbing.com/sams-plumbing' })
    expect(j.steps['sub-contract-email']).toMatchObject({ state: 'opened', headline: 'Sent Aug 2 · opened Aug 2', action: { label: 'Resend' } })
    expect(j.steps['sub-contract']).toMatchObject({ state: 'opened', headline: 'Opened, not signed yet' })
    expect(j.summary).toBe('portal visited · 1 contract')
  })

  it('a supply house: the RFQ row carries sent, viewed and quoted', () => {
    const h = { kind: 'house' as const, id: 'h1', name: 'Ferguson' }
    let j = houseJourney(h, { rfqs: [] }, NOW)
    expect(j.steps['quote-email']?.state).toBe('never')
    j = houseJourney(h, { rfqs: [{ id: 'r1', token: 'qtok', status: 'sent', sent_via: 'email', sent_to: 'counter@ferguson.example', requested_on: '2026-09-10', viewed_at: null, reminder_count: 1, created_at: '2026-09-10T10:00:00Z' }] }, NOW)
    expect(j.steps['quote-email']).toMatchObject({ state: 'sent', headline: 'Emailed Sep 10 · not opened', link: '/q/qtok', action: { label: 'Nudge' } })
    expect(j.steps['quote-email']?.detail).toContain('1 nudge')
    j = houseJourney(h, { rfqs: [{ id: 'r1', token: 'qtok', status: 'quoted', sent_via: 'manual', sent_to: null, requested_on: '2026-09-10', viewed_at: '2026-09-11T10:00:00Z', reminder_count: 0, created_at: '2026-09-10T10:00:00Z' }] }, NOW)
    expect(j.steps['quote-email']).toMatchObject({ state: 'signed', headline: 'Link shared Sep 10 · opened Sep 11' })
    expect(j.steps['quote-submitted']).toMatchObject({ state: 'signed', headline: 'Quoted' })
    expect(j.steps['job-account-email']?.state).toBe('na')
  })

  it('the firm: recipients confirmed / waiting / paused, the portal link, now and digest sends', () => {
    const f = { kind: 'firm' as const, id: 'f1', name: 'Sample & Partner' }
    const j = firmJourney(
      f,
      {
        portalLinks: [{ token: 'ltok', revoked_at: null, created_at: '2026-09-11T00:00:00Z' }],
        recipients: [
          { name: 'Ann', email: 'ann@firm.example', mode: 'now', confirmed_at: '2026-09-12T12:00:00Z', paused_at: null, removed_at: null, last_digest_at: null },
          { name: 'Bo', email: 'bo@firm.example', mode: 'digest', confirmed_at: null, paused_at: null, removed_at: null, last_digest_at: null },
        ],
        queue: [{ sent_now_at: '2026-09-14T12:00:00Z', digested_at: null, created_at: '2026-09-14T12:00:00Z' }],
      },
      NOW,
    )
    expect(j.steps['firm-confirm-email']).toMatchObject({ state: 'signed', headline: '1 address confirmed · 1 waiting', detail: 'Ann, Bo' })
    expect(j.steps['firm-portal']).toMatchObject({ state: 'sent', link: '/legal?t=ltok' })
    expect(j.steps['firm-now-email']).toMatchObject({ state: 'sent', headline: 'Last Sep 14', detail: '1 email' })
    expect(j.steps['firm-digest-email']).toMatchObject({ state: 'never', headline: 'No digest sent yet' })
    expect(j.summary).toBe('2 recipients · 1 confirmed · portal link made')
  })

  it('every step of every applicable journey gets an answer, for every subject kind', () => {
    const all = customerJourneys()
    const cases = [
      buildPersonJourney({ kind: 'customer', id: 'c', name: 'C' }, { kind: 'customer', rows: { ...emptyCustomer(), gcStatements: [{ sent_at: '2026-09-01T00:00:00Z', total: 1, sent_to: null }] } }, NOW),
      buildPersonJourney({ kind: 'sub', id: 's', name: 'S' }, { kind: 'sub', rows: { portalLinks: [], portalSlug: null, visits: null, contracts: [] } }, NOW),
      buildPersonJourney({ kind: 'house', id: 'h', name: 'H' }, { kind: 'house', rows: { rfqs: [] } }, NOW),
      buildPersonJourney({ kind: 'firm', id: 'f', name: 'F' }, { kind: 'firm', rows: { portalLinks: [], recipients: [], queue: [] } }, NOW),
    ]
    for (const pj of cases) {
      for (const jid of pj.journeys) {
        const journey = all.find((x) => x.id === jid)!
        for (const step of journey.steps) expect(pj.steps[step.id], `${pj.subject.kind} ${jid}/${step.id}`).toBeDefined()
      }
    }
    expect(() => buildPersonJourney({ kind: 'sub', id: 's', name: 'S' }, { kind: 'house', rows: { rfqs: [] } }, NOW)).toThrow()
  })

  it('helpers: day words in company time, days between, job labels', () => {
    expect(dayWord('2026-09-04T18:00:00Z', NOW)).toBe('Sep 4')
    expect(dayWord('2026-09-04', NOW)).toBe('Sep 4')
    expect(dayWord('2025-12-31T12:00:00Z', NOW)).toBe('Dec 31, 2025')
    expect(dayWord(null, NOW)).toBe('')
    expect(daysBetween('2026-08-07T12:00:00Z', NOW)).toBe(40)
    expect(jobLabel({ id: 'x', hcp_number: '363', click_number: null, job_name: 'P', status: null, customer_id: null, gc_customer_id: null })).toBe('J363')
    expect(jobLabel({ id: 'x', hcp_number: null, click_number: '12', job_name: 'P', status: null, customer_id: null, gc_customer_id: null })).toBe('J12')
    expect(jobLabel({ id: 'x', hcp_number: null, click_number: null, job_name: 'Palmer', status: null, customer_id: null, gc_customer_id: null })).toBe('Palmer')
  })
})

describe('customerRowsForJob (v2.3615)', () => {
  it('keeps the one job and its per-job rows, and every customer-level row', () => {
    const rows = {
      jobs: [{ id: 'j1' }, { id: 'j2' }],
      estimates: [{ id: 'e1' }],
      estimateEvents: [{ estimate_id: 'e1' }],
      contracts: [{ id: 'c1', job_id: 'j1' }, { id: 'c2', job_id: 'j2' }],
      invoices: [{ id: 'i1', job_id: 'j2' }],
      hazmat: [{ job_id: 'j1' }],
      portalLinks: [{ token: 't' }],
      portalSlug: 'slug',
      portalOpens: null,
      bidRooms: [{ id: 'r1' }],
      bidRoomEvents: [],
      submittalRooms: [],
      submittalEvents: [],
      testReports: [{ id: 'tr1', job_id: 'j1' }, { id: 'tr2', job_id: 'j2' }],
      gcStatements: [{ sent_at: null }],
      demandLetters: [{ job_id: 'j2' }],
      lienFilings: [{ job_id: 'j1' }],
      lienReleases: [{ job_id: 'j2' }],
    } as unknown as CustomerRows
    const one = customerRowsForJob(rows, 'j1')
    expect(one.jobs.map((j) => j.id)).toEqual(['j1'])
    expect(one.contracts.map((c) => c.id)).toEqual(['c1'])
    expect(one.invoices).toEqual([])
    expect(one.hazmat).toHaveLength(1)
    expect(one.testReports.map((t) => t.id)).toEqual(['tr1'])
    expect(one.demandLetters).toEqual([])
    expect(one.lienFilings).toHaveLength(1)
    expect(one.lienReleases).toEqual([])
    // customer-level rows are untouched
    expect(one.estimates).toBe(rows.estimates)
    expect(one.portalLinks).toBe(rows.portalLinks)
    expect(one.bidRooms).toBe(rows.bidRooms)
    expect(one.gcStatements).toBe(rows.gcStatements)
    expect(one.portalSlug).toBe('slug')
  })
  it('leaves no jobs for an id the customer does not hold', () => {
    const rows = { jobs: [{ id: 'j1' }], contracts: [], invoices: [], hazmat: [], testReports: [], demandLetters: [], lienFilings: [], lienReleases: [] } as unknown as CustomerRows
    expect(customerRowsForJob(rows, 'nope').jobs).toEqual([])
  })
})
