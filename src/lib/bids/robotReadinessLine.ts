/**
 * The robot-readiness line under the bid form's plans link (v2.3142): one
 * sentence that tells the estimator, while the bid is still in front of her,
 * whether the robots will shadow it — and if not, exactly what to fix.
 *
 * Three tones:
 *  - 'ready'   — every required input is present and the plans probe passed
 *  - 'blocked' — something the robots need is missing; `gaps` names each fix
 *  - 'off'     — the estimator opted this bid out ("Don't let robots shadow this")
 * plus 'idle' (nothing to say yet: no plans link typed) and 'checking' (probe
 * in flight). Pure module — no React, no Supabase.
 */
import { robotBidReadiness, type RobotReadinessBidFields } from './robotBidReadiness'

/** The Drive service account estimators share plan files with. */
export const ROBOT_INTAKE_ACCOUNT = 'drive-intake@pipetooling-drive.iam.gserviceaccount.com'

/** The plan-fetch probe's verdict for the link in the field. */
export type PlansProbeState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'readable'; note: string | null }
  | { kind: 'unreadable'; note: string | null }
  | { kind: 'error'; message: string }

export interface ReadinessLineInputs {
  plansLink: string
  address: string
  distanceFromOffice: string
  bidDueDate: string
  /** Name of the selected service type ('Plumbing', 'Electrical', …) or ''. */
  serviceTypeName: string
  serviceTypeId: string
  robotOptOut: boolean
  probe: PlansProbeState
  /** True while the form is computing distance from the address. */
  distanceBusy?: boolean
}

export interface ReadinessGap {
  key: 'plans' | 'plans-unreadable' | 'discipline' | 'distance' | 'address'
  text: string
  /** Offer the "Copy intake address" action for this gap. */
  copyIntake?: boolean
}

export interface ReadinessLine {
  tone: 'ready' | 'blocked' | 'off' | 'idle' | 'checking'
  title: string
  detail: string
  gaps: ReadinessGap[]
}

const PLUMBING = /plumbing/i

function facts(i: ReadinessLineInputs): string[] {
  const out: string[] = []
  if (i.probe.kind === 'readable') {
    // Folder probe notes read "folder · 3 PDFs, merged on fetch: a.pdf, …" — keep "folder shared · 3 PDFs".
    const n = i.probe.note ?? ''
    out.push(n.startsWith('folder') ? n.split(':')[0]!.replace(/,.*$/, '').replace(/^folder\s*·\s*/, 'folder shared · ') : 'plans readable')
  }
  if (i.serviceTypeName) out.push(i.serviceTypeName.toLowerCase())
  if (i.distanceFromOffice.trim()) out.push(`${i.distanceFromOffice.trim()} mi`)
  if (i.bidDueDate) out.push(`due ${i.bidDueDate}`)
  return out
}

export function buildReadinessLine(i: ReadinessLineInputs): ReadinessLine {
  if (i.robotOptOut) {
    return {
      tone: 'off',
      title: 'Robots will leave this bid alone',
      detail: 'It stays off the shadow queue and out of the coverage count. Untick to put it back.',
      gaps: [],
    }
  }
  const link = i.plansLink.trim()
  if (!link) {
    return {
      tone: 'idle',
      title: 'Add the plans link and the robots will shadow this bid',
      detail: 'A Drive file or folder the intake account can open. Nothing else is needed from you.',
      gaps: [{ key: 'plans', text: 'No plans link yet.' }],
    }
  }
  if (i.probe.kind === 'checking') {
    return { tone: 'checking', title: 'Checking whether robots can open the plans…', detail: '', gaps: [] }
  }

  const gaps: ReadinessGap[] = []
  if (i.serviceTypeId && !PLUMBING.test(i.serviceTypeName)) {
    gaps.push({ key: 'discipline', text: `Robots bid plumbing only — this is a${/^[aeiou]/i.test(i.serviceTypeName) ? 'n' : ''} ${i.serviceTypeName.toLowerCase() || 'other-division'} bid.` })
  }
  if (i.probe.kind === 'unreadable') {
    const note = i.probe.note ?? ''
    const notShared = /not shared|no permission|403|404/i.test(note)
    gaps.push({
      key: 'plans-unreadable',
      text: notShared
        ? `This ${/folder/i.test(note) ? 'folder' : 'file'} isn't shared with the intake account. Share it with ${ROBOT_INTAKE_ACCOUNT} (Viewer), then check again.`
        : note || 'The robots could not open this link.',
      copyIntake: notShared,
    })
  } else if (i.probe.kind === 'error') {
    // The raw message is a transport string ("non-2xx status code") — say what to do instead.
    gaps.push({ key: 'plans-unreadable', text: 'Couldn’t reach the plans check just now — hit Check again, or save and the robots will retry on their own.' })
  }
  if (!i.distanceFromOffice.trim() && !i.distanceBusy) {
    gaps.push(
      i.address.trim()
        ? { key: 'distance', text: 'Distance from office is blank — it fills itself when you save.' }
        : { key: 'address', text: 'No project address, so distance can’t be measured — the robot will ask before pricing travel.' },
    )
  }
  const readiness = robotBidReadiness(toReadinessFields(i))

  const blocking = gaps.filter((g) => g.key === 'plans-unreadable' || g.key === 'discipline')
  if (blocking.length > 0 || readiness.state === 'missing') {
    const first = blocking[0] ?? gaps[0]
    return {
      tone: 'blocked',
      title: first?.key === 'discipline' ? 'Robots don’t bid this division' : 'Robots can’t open these plans yet',
      detail: gaps.map((g) => g.text).join(' '),
      gaps,
    }
  }
  const soft = gaps.filter((g) => g.key === 'distance' || g.key === 'address')
  return {
    tone: 'ready',
    title: 'Robots will shadow this bid within the hour',
    detail: `${facts(i).join(' · ')}. The sealed number shows on your Dashboard; nobody sees it until you send.${soft.length ? ' ' + soft.map((g) => g.text).join(' ') : ''}`,
    gaps: soft,
  }
}

function toReadinessFields(i: ReadinessLineInputs): RobotReadinessBidFields {
  return {
    bid_number: null,
    project_name: null,
    plans_link: i.plansLink,
    service_type_id: i.serviceTypeId || null,
    distance_from_office: i.distanceFromOffice || null,
    bid_due_date: i.bidDueDate || null,
    gc_builder_id: null,
    customer_id: null,
  }
}

/** True when the link is worth probing (a Drive file or folder URL). */
export function isProbeableLink(link: string): boolean {
  return /drive\.google\.com\/(file\/d\/|drive\/(u\/\d+\/)?folders\/|(open|uc)\?)/.test(link.trim())
}
