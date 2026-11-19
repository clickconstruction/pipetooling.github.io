/**
 * Calibration-standard teachers (v2.3091, Settings → Digital twins): which
 * humans the robot program calibrates to. The kernel lives in
 * supabase/functions/_shared/twinTeachers.ts since v2.7934, so the panel and the
 * dev seat's plan_calibration_standard offer the same people in the same words.
 */
export type { TeacherCandidate } from '../../supabase/functions/_shared/twinTeachers'
export { TEACHER_ROLES, calibrationStandardSummary, calibrationStandardToast, canBeCalibrationStandard, teacherCandidates } from '../../supabase/functions/_shared/twinTeachers'
