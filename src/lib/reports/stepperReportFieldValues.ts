import {
  REPORT_FIELD_LABEL_JOB_COMPLETION,
  REPORT_FIELD_LABEL_LEGACY_WHO,
} from '../reportTemplateFieldDisplay'

/**
 * Field mapping for stepper-filed Status Reports (v2.2078): "Update % done"
 * now files a real report instead of a bare pct write, so the stepper's two
 * inputs (percent + optional note) have to land on the Status Report
 * template's fields. Pure — the caller fetches the template's fields.
 *
 * Rules:
 * - The percent goes to the template's percent field (`percent_0_100` input
 *   type, or the canonical "How complete is the job?" / legacy label).
 * - The note goes to "What is the status of the job?" when the template has
 *   it, else the first long-text field.
 * - Every other field submits empty — same as leaving it blank in the modal.
 */

export const STEPPER_REPORT_NOTE_FIELD = 'What is the status of the job?'

type TemplateField = { label: string; input_type?: string | null }

function isPercentField(f: TemplateField): boolean {
  return (
    (f.input_type ?? 'long_text') === 'percent_0_100' ||
    f.label === REPORT_FIELD_LABEL_JOB_COMPLETION ||
    f.label === REPORT_FIELD_LABEL_LEGACY_WHO
  )
}

export function buildStepperReportFieldValues(
  templateFields: readonly TemplateField[],
  pct: number,
  note: string,
): Record<string, string> {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)))
  const trimmedNote = note.trim()
  const fv: Record<string, string> = {}
  const longTextNonPercent = (f: TemplateField) =>
    (f.input_type ?? 'long_text') === 'long_text' && !isPercentField(f)
  const noteTarget =
    templateFields.find((f) => f.label === STEPPER_REPORT_NOTE_FIELD && longTextNonPercent(f)) ??
    templateFields.find(longTextNonPercent)
  for (const f of templateFields) {
    if (isPercentField(f)) {
      fv[f.label] = String(clamped)
    } else if (noteTarget && f.label === noteTarget.label) {
      fv[f.label] = trimmedNote
    } else {
      fv[f.label] = ''
    }
  }
  return fv
}
