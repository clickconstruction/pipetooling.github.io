/**
 * What customers see (Settings dev tab, v2.2758): the journeys — every surface a homeowner, a
 * general contractor and a subcontractor meets, in the order they meet them. Pure data so the
 * tab, the tests and the docs agree on what is rendered and where it comes from.
 *
 * A step renders one of four ways:
 *   page     — the real public page in an iframe, opened with the sample token
 *   email    — the real email builder, run in the browser over the live Settings
 *   external — sent by another system (Stripe); named, not rendered
 *   soon     — a surface this tab does not render yet
 */
import { SAMPLE_TOKEN, SAMPLE_TOKEN_DONE, SAMPLE_TOKEN_GC } from './customerSample'

export type SampleEmailId = 'estimate' | 'bid-room' | 'bid-room-revised' | 'contract'

export type JourneyStepRender =
  | { kind: 'page'; path: string }
  | { kind: 'email'; email: SampleEmailId }
  | { kind: 'external'; note: string }
  | { kind: 'soon'; note: string }

export type JourneyStep = {
  id: string
  label: string
  /** What sends or serves it — the function or route, in the app's own words. */
  sublabel: string
  /** When in the relationship it happens. */
  when: string
  /** The Settings this surface reflects — the reason to look at it after a change. */
  reflects: string[]
  render: JourneyStepRender
}

export type JourneyId = 'homeowner' | 'gc' | 'sub'

export type Journey = { id: JourneyId; title: string; subtitle: string; steps: JourneyStep[] }

export const ESTIMATE_SAMPLE_PATH = `/estimate/accept?t=${SAMPLE_TOKEN}`
export const ESTIMATE_SAMPLE_DONE_PATH = `/estimate/accept?t=${SAMPLE_TOKEN_DONE}`
export const BID_ROOM_SAMPLE_PATH = `/bid-room?t=${SAMPLE_TOKEN}`
export const BID_ROOM_SAMPLE_DONE_PATH = `/bid-room?t=${SAMPLE_TOKEN_DONE}`
export const CUSTOMER_PORTAL_SAMPLE_PATH = `/portal?t=${SAMPLE_TOKEN}`
export const GC_PORTAL_SAMPLE_PATH = `/portal?t=${SAMPLE_TOKEN_GC}`
export const SUB_PORTAL_SAMPLE_PATH = `/sub?t=${SAMPLE_TOKEN}`
export const CONTRACT_SAMPLE_PATH = `/contract/accept?t=${SAMPLE_TOKEN}`
export const CONTRACT_SAMPLE_DONE_PATH = `/contract/accept?t=${SAMPLE_TOKEN_DONE}`

export function customerJourneys(): Journey[] {
  return [
    {
      id: 'homeowner',
      title: 'Homeowner',
      subtitle: 'Sam Sample · an estimate, then a job, then a bill',
      steps: [
        {
          id: 'estimate-email',
          label: 'Estimate email',
          sublabel: 'Estimates → Send to customer',
          when: 'Day 0',
          reflects: ['Estimate email body template', 'Acceptance page logo', 'Acceptance page footer'],
          render: { kind: 'email', email: 'estimate' },
        },
        {
          id: 'estimate-page',
          label: 'Accept page',
          sublabel: 'the link in that email',
          when: 'Days 0–14',
          reflects: ['Estimate customer copy (accept section, labels, checkbox)', 'Estimate public terms', 'Acceptance page footer', 'Acceptance page logo'],
          render: { kind: 'page', path: ESTIMATE_SAMPLE_PATH },
        },
        {
          id: 'estimate-thankyou',
          label: 'Thank-you',
          sublabel: 'same page, after signing',
          when: 'Right after',
          reflects: ['Thank-you heading and body'],
          render: { kind: 'page', path: ESTIMATE_SAMPLE_DONE_PATH },
        },
        {
          id: 'bill-email',
          label: 'Bill email',
          sublabel: 'Stripe sends it',
          when: 'After the work',
          reflects: [],
          render: { kind: 'external', note: 'Stripe sends the invoice email from its own template when you bill through Stripe. It is not built by this app, so it is not rendered here; Stripe → Settings → Emails shows it.' },
        },
        {
          id: 'customer-portal',
          label: 'Portal',
          sublabel: 'my.clickplumbing.com/sam-sample',
          when: 'Any time',
          reflects: ['Portal letterhead (portalCompany)', 'Request-a-visit and ask-us-to-bid forms', 'Agreements card'],
          render: { kind: 'page', path: CUSTOMER_PORTAL_SAMPLE_PATH },
        },
      ],
    },
    {
      id: 'gc',
      title: 'General contractor',
      subtitle: 'Sample Contracting · a bid, then the room, then a change order',
      steps: [
        {
          id: 'bid-room-email',
          label: 'Bid room email',
          sublabel: 'Bids → Cover Letter → Publish & send',
          when: 'Day 0',
          reflects: ['Bid cover letter terms default (the validity days)', 'Sender signature (your name, phone, email)'],
          render: { kind: 'email', email: 'bid-room' },
        },
        {
          id: 'bid-room',
          label: 'Bid room',
          sublabel: 'the link in that email',
          when: 'Until signed',
          reflects: ['Bid cover letter terms default', 'Bid cover letter exclusions default', 'Header brand'],
          render: { kind: 'page', path: BID_ROOM_SAMPLE_PATH },
        },
        {
          id: 'bid-room-revised-email',
          label: 'Revised send',
          sublabel: 'Publish update & notify',
          when: 'When plans change',
          reflects: ['Revision note wording'],
          render: { kind: 'email', email: 'bid-room-revised' },
        },
        {
          id: 'bid-room-signed',
          label: 'Signed, with a change order',
          sublabel: 'same room, after signing',
          when: 'During the job',
          reflects: ['Signed banner wording', 'Change-order card'],
          render: { kind: 'page', path: BID_ROOM_SAMPLE_DONE_PATH },
        },
        {
          id: 'gc-portal',
          label: 'Portal as GC',
          sublabel: 'my.clickplumbing.com/sample-contracting',
          when: 'Any time',
          reflects: ['Portal letterhead (portalCompany)', 'AS GC tags and owner names', 'Agreements card'],
          render: { kind: 'page', path: GC_PORTAL_SAMPLE_PATH },
        },
      ],
    },
    {
      id: 'sub',
      title: 'Subcontractor',
      subtitle: "Sam's Plumbing LLC · the portal is their whole experience",
      steps: [
        {
          id: 'sub-portal-text',
          label: 'Portal link, texted',
          sublabel: 'People → Subs → 🌐 → Copy link',
          when: 'Once',
          reflects: [],
          render: { kind: 'external', note: 'Staff copy the address and text it themselves — there is no app-built message. The help guide suggests wording.' },
        },
        {
          id: 'sub-portal',
          label: 'Sub portal',
          sublabel: 'my.clickplumbing.com/sams-plumbing',
          when: 'Weekly',
          reflects: ['Sub pay-run day and explainer (Settings)', 'Portal letterhead (portalCompany)', 'Paperwork states and the insurance-expiry nudge'],
          render: { kind: 'page', path: SUB_PORTAL_SAMPLE_PATH },
        },
        {
          id: 'sub-contract-email',
          label: 'Contract email',
          sublabel: 'People → Contracts → Send for signature',
          when: 'On hire',
          reflects: ['Your opening message and subject (typed per send)', 'Sender name and email (the Reply-To)', 'The sub\'s portal address, when they have one'],
          render: { kind: 'email', email: 'contract' },
        },
        {
          id: 'sub-contract',
          label: 'Contract to sign',
          sublabel: 'the link in that email, or Paperwork → Sign',
          when: 'On hire',
          reflects: ['Signing page chrome and the agree checkbox wording'],
          render: { kind: 'page', path: CONTRACT_SAMPLE_PATH },
        },
        {
          id: 'sub-contract-signed',
          label: 'Signed',
          sublabel: 'same page, after signing',
          when: 'Right after',
          reflects: ['Contract thank-you and the sign-in prompt'],
          render: { kind: 'page', path: CONTRACT_SAMPLE_DONE_PATH },
        },
      ],
    },
  ]
}

/** The first step a viewer should land on: the first renderable one. */
export function firstRenderableStep(journeys: Journey[]): { journeyId: JourneyId; stepId: string } | null {
  for (const j of journeys) {
    for (const s of j.steps) {
      if (s.render.kind === 'page' || s.render.kind === 'email') return { journeyId: j.id, stepId: s.id }
    }
  }
  return null
}

export function findStep(journeys: Journey[], journeyId: JourneyId, stepId: string): JourneyStep | null {
  return journeys.find((j) => j.id === journeyId)?.steps.find((s) => s.id === stepId) ?? null
}
