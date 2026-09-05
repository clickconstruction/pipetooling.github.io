import { supabase } from '../supabase'

/**
 * Work-order notification dispatch (RUN_SUBS_PLAN Phase 4). Rides the
 * existing send-workflow-notification edge function — the 4.1 migration
 * seeded the three email_templates rows, so no function changes. Everything
 * is best-effort: failures log and never surface.
 */

/** "Aug 12 → Aug 19" (Chicago wall dates), tolerating open ends. */
export function formatWorkOrderWindow(start: string | null, end: string | null): string {
  const fmt = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number)
    if (!y || !m || !d) return ymd
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  }
  if (start && end) return `${fmt(start)} → ${fmt(end)}`
  if (start) return `starting ${fmt(start)}`
  if (end) return `by ${fmt(end)}`
  return 'not set'
}

export function formatWorkOrderAmount(amount: number): string {
  return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function invoke(body: Record<string, unknown>): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('send-workflow-notification', { body })
    if (error) console.error('Work-order notification failed:', error.message)
  } catch (err) {
    console.error('Work-order notification error:', err)
  }
}

/** Office → sub: "you've been offered work." */
export async function notifyWorkOrderOffered(args: {
  stepId: string
  projectId: string
  projectName: string
  stepName: string
  offeredByName: string
  recipientName: string
  recipientEmail: string | null
  recipientUserId: string | null
  amount: number
  proposedStart: string | null
  proposedEnd: string | null
}): Promise<void> {
  if (!args.recipientEmail) return
  const amount = formatWorkOrderAmount(args.amount)
  const windowLabel = formatWorkOrderWindow(args.proposedStart, args.proposedEnd)
  const link = `${window.location.origin}/dashboard`
  await invoke({
    template_type: 'work_order_offered',
    step_id: args.stepId,
    recipient_email: args.recipientEmail,
    recipient_name: args.recipientName,
    recipient_user_id: args.recipientUserId ?? undefined,
    push_title: 'New work order',
    push_body: `${args.stepName} at ${args.projectName} — ${amount}, ${windowLabel}`,
    push_url: link,
    variables: {
      name: args.recipientName,
      email: args.recipientEmail,
      project_name: args.projectName,
      stage_name: args.stepName,
      offered_by: args.offeredByName,
      amount,
      window: windowLabel,
      workflow_link: link,
    },
  })
}

/**
 * Office → sub for a SHEET work order (Sub Work Orders train, v2.2786): same
 * template as a step offer, but the "project" is the sheet's job label, the
 * stage reads "Sub work order", and the link is the sub's portal (where they
 * sign). send-workflow-notification accepts labor_job_id in place of step_id.
 */
export async function notifySheetWorkOrderOffered(args: {
  /** The sheet the order hangs off — or, for a job-anchored order (v2.2819), the commitment id via `workOrderId`. */
  laborJobId?: string | null
  workOrderId?: string | null
  sheetLabel: string
  offeredByName: string
  recipientName: string
  recipientEmail: string | null
  recipientUserId: string | null
  amount: number
  proposedStart: string | null
  proposedEnd: string | null
  portalUrl: string | null
}): Promise<void> {
  if (!args.recipientEmail) return
  const amount = formatWorkOrderAmount(args.amount)
  const windowLabel = formatWorkOrderWindow(args.proposedStart, args.proposedEnd)
  const link = args.portalUrl ?? `${window.location.origin}/dashboard`
  await invoke({
    template_type: 'work_order_offered',
    ...(args.laborJobId ? { labor_job_id: args.laborJobId } : {}),
    ...(args.workOrderId ? { work_order_id: args.workOrderId } : {}),
    recipient_email: args.recipientEmail,
    recipient_name: args.recipientName,
    recipient_user_id: args.recipientUserId ?? undefined,
    push_title: 'New work order',
    push_body: `${args.sheetLabel} — ${amount}, ${windowLabel}`,
    push_url: link,
    variables: {
      name: args.recipientName,
      email: args.recipientEmail,
      project_name: args.sheetLabel,
      stage_name: 'Sub work order',
      offered_by: args.offeredByName,
      amount,
      window: windowLabel,
      workflow_link: link,
    },
  })
}

/** Sub → office: the answer, addressed with the context the respond RPC returned. */
export async function notifyWorkOrderAnswered(args: {
  accepted: boolean
  responderName: string
  reason?: string | null
  report: {
    step_id?: string
    step_name?: string
    project_id?: string
    project_name?: string
    amount?: number
    proposed_start?: string | null
    proposed_end?: string | null
    notify_user_id?: string
    notify_email?: string
    notify_name?: string
  }
}): Promise<void> {
  const r = args.report
  if (!r.notify_email || !r.step_id) return
  const amount = formatWorkOrderAmount(Number(r.amount ?? 0))
  const windowLabel = formatWorkOrderWindow(r.proposed_start ?? null, r.proposed_end ?? null)
  const link = r.project_id ? `${window.location.origin}/workflows/${r.project_id}#step-${r.step_id}` : `${window.location.origin}/projects`
  const stepName = r.step_name ?? 'a step'
  const projectName = r.project_name ?? 'a project'
  await invoke({
    template_type: args.accepted ? 'work_order_accepted' : 'work_order_declined',
    step_id: r.step_id,
    recipient_email: r.notify_email,
    recipient_name: r.notify_name ?? r.notify_email,
    recipient_user_id: r.notify_user_id,
    push_title: args.accepted ? `${args.responderName} accepted` : `${args.responderName} declined`,
    push_body: `${stepName} at ${projectName} — ${amount}${args.accepted ? '' : ` · "${args.reason ?? ''}"`}`,
    push_url: link,
    variables: {
      name: r.notify_name ?? '',
      email: r.notify_email,
      project_name: projectName,
      stage_name: stepName,
      responder: args.responderName,
      amount,
      window: windowLabel,
      reason: args.reason ?? '',
      workflow_link: link,
    },
  })
}
