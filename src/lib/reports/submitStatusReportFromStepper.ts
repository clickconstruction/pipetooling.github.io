import { supabase } from '../supabase'
import { findStatusReportTemplateId } from '../reportTemplateDisplayName'
import { buildStepperReportFieldValues } from './stepperReportFieldValues'

/**
 * Files a Status Report from the "Update % done" stepper (v2.2078): the
 * stepper's percent + note become a real report — it lands in the job's
 * reports list, bumps the reports chip, clears the Report-due reminder, and
 * fires the same office notifications as the report modals. The caller then
 * runs the shared report pipeline (`propagateReportPctToJob` → Ready-to-Bill
 * prompt), so the stepper and Leave Report are one flow with two doors.
 *
 * Returns `no_template` when no Status Report template exists so the caller
 * can fall back to the legacy bare-% write instead of stranding the tech.
 */
export async function submitStatusReportFromStepper(args: {
  authUserId: string
  jobId: string
  pct: number
  note: string
}): Promise<
  | { ok: true; fieldValues: Record<string, string> }
  | { ok: false; reason: 'no_template' | 'error'; message: string }
> {
  try {
    const { data: templates, error: tErr } = await supabase.from('report_templates').select('id, name')
    if (tErr) return { ok: false, reason: 'error', message: tErr.message }
    const templateId = findStatusReportTemplateId((templates ?? []) as { id: string; name: string }[])
    if (!templateId) return { ok: false, reason: 'no_template', message: 'No Status Report template' }

    const { data: fieldRows, error: fErr } = await supabase
      .from('report_template_fields')
      .select('label, input_type')
      .eq('template_id', templateId)
      .order('sequence_order')
    if (fErr) return { ok: false, reason: 'error', message: fErr.message }
    const fieldValues = buildStepperReportFieldValues(
      (fieldRows ?? []) as { label: string; input_type?: string | null }[],
      args.pct,
      args.note,
    )

    // Best-effort location, same contract as the report modals — but with a
    // shorter timeout: the stepper is a two-tap flow and must stay quick.
    let reportedAtLat: number | null = null
    let reportedAtLng: number | null = null
    if ('geolocation' in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 3500,
            maximumAge: 60000,
          })
        })
        reportedAtLat = pos.coords.latitude
        reportedAtLng = pos.coords.longitude
      } catch {
        // proceed without location
      }
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('reports')
      .insert({
        template_id: templateId,
        created_by_user_id: args.authUserId,
        field_values: fieldValues,
        job_ledger_id: args.jobId,
        project_id: null,
        bid_id: null,
        ...(reportedAtLat != null && reportedAtLng != null
          ? { reported_at_lat: reportedAtLat, reported_at_lng: reportedAtLng }
          : null),
      })
      .select('id')
      .single()
    if (insertErr) return { ok: false, reason: 'error', message: insertErr.message }

    if (inserted?.id) {
      // Same best-effort fan-out as the report modals — the report is saved either way.
      void supabase.functions
        .invoke('send-report-notification', { body: { report_id: inserted.id } })
        .catch(() => {/* best-effort */})
      void supabase.functions
        .invoke('send-report-email', { body: { report_id: inserted.id } })
        .catch(() => {/* best-effort */})
    }
    return { ok: true, fieldValues }
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : 'Could not save the report' }
  }
}
