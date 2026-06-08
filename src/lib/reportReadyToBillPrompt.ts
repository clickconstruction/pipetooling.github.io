import {
  REPORT_FIELD_LABEL_JOB_COMPLETION,
  REPORT_FIELD_LABEL_LEGACY_WHO,
  tryParsePercent0to100,
} from './reportTemplateFieldDisplay'

/**
 * True when a submitted report's `field_values` say the job is 100% complete — i.e. the
 * "How complete is the job?" percent field (or its legacy "Who was on the job?" key) is exactly 100.
 *
 * Used to decide whether, right after a report saves on a Working job, we prompt the submitter to
 * move the job to "Ready to bill". The new key wins when both are present.
 */
export function reportSaysJobComplete(
  fieldValues: Record<string, unknown> | null | undefined,
): boolean {
  if (!fieldValues) return false
  const raw =
    fieldValues[REPORT_FIELD_LABEL_JOB_COMPLETION] ?? fieldValues[REPORT_FIELD_LABEL_LEGACY_WHO]
  if (raw == null) return false
  return tryParsePercent0to100(typeof raw === 'string' ? raw : String(raw)) === 100
}
