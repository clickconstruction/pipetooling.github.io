/**
 * Robot readiness for a Bid Board row (v2.2530): can a digital twin duplicate
 * this bid? One kernel decides both the icon state and the modal contents, so
 * the row and the explanation can never disagree.
 *
 * States:
 *  - 'done'    — a twin bid exists for this bid (bids.twin_source_bid_id pairing)
 *  - 'ready'   — the required inputs are present; the kickoff prompt can run
 *  - 'missing' — at least one required input is absent
 */

export interface RobotReadinessBidFields {
  bid_number: string | null
  project_name: string | null
  plans_link: string | null
  service_type_id: string | null
  distance_from_office: number | string | null
  bid_due_date: string | null
  gc_builder_id: string | null
  customer_id: string | null
}

export interface RobotReadinessItem {
  key: 'plans' | 'service-type' | 'gc' | 'distance' | 'due-date'
  label: string
  ok: boolean
  /** Required items block the 'ready' state; the rest are shown as warnings. */
  required: boolean
  /** How to fix it, shown in the modal when not ok. */
  fix: string
}

export interface RobotBidReadiness {
  state: 'done' | 'ready' | 'missing'
  items: RobotReadinessItem[]
  /** The unmet REQUIRED items (empty unless state is 'missing'). */
  missing: RobotReadinessItem[]
}

export function robotBidReadiness(
  bid: RobotReadinessBidFields,
  opts?: { twinBidExists?: boolean },
): RobotBidReadiness {
  const items: RobotReadinessItem[] = [
    {
      key: 'plans',
      label: 'Plans PDF filed',
      ok: !!bid.plans_link?.trim(),
      required: true,
      fix: 'The robot reads the plan set through the bid’s plans link — file it on the Edit form.',
    },
    {
      key: 'service-type',
      label: 'Service type set',
      ok: !!bid.service_type_id,
      required: true,
      fix: 'Service type picks the robot’s price book and doctrine.',
    },
    {
      key: 'gc',
      label: 'GC / customer on the bid',
      ok: !!(bid.gc_builder_id || bid.customer_id),
      required: false,
      fix: 'Not blocking, but the robot’s bid copy carries the GC for context.',
    },
    {
      key: 'distance',
      label: 'Distance from office',
      ok: bid.distance_from_office != null && `${bid.distance_from_office}`.trim() !== '',
      required: false,
      fix: 'Travel pricing needs the mileage — without it the robot omits the travel row.',
    },
    {
      key: 'due-date',
      label: 'Bid due date',
      ok: !!bid.bid_due_date,
      required: false,
      fix: 'Not blocking; the robot notes the deadline in its plan.',
    },
  ]
  if (opts?.twinBidExists) return { state: 'done', items, missing: [] }
  const missing = items.filter((i) => i.required && !i.ok)
  return { state: missing.length ? 'missing' : 'ready', items, missing }
}

/**
 * The copy-into-an-LLM kickoff prompt for a ready bid — the fleet roadmap's
 * shadow-mode trigger in manual form. Logistics only; restates the blind rule.
 */
export function buildRobotBidPrompt(bid: RobotReadinessBidFields): string {
  const num = bid.bid_number ? `b${bid.bid_number}` : 'this bid'
  const name = bid.project_name?.trim() || 'the project'
  const due = bid.bid_due_date ? `, due ${bid.bid_due_date}` : ''
  const miles =
    bid.distance_from_office != null && `${bid.distance_from_office}`.trim() !== ''
      ? `${bid.distance_from_office} mi from the office`
      : 'distance not recorded — ask before pricing travel'
  return `You are the ClickTooling estimator twin. Using the twin-mcp connector, produce a complete robot bid for ${num} (${name}${due}; ${miles}).

1. get_brief, then get_work_state for ${num} — the plan set is filed on the bid (plan-fetch).
2. Run the full pipeline per the harness guides: substrate + census (orientation gate, riser cross-check), CountTooling takeoff import with external_ref ${num} and page rotations set, then counts + pricing on the robot price book, with stage notes on the bid ledger.
3. BLIND RULE: never open the human bid's counts, pricing, or value — logistics only. If an input is missing, ask via add_bid_note instead of guessing.
4. Mark the CountTooling project ready for review and file the audit so a human can score it.`
}
