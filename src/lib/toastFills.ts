/**
 * A toast's fill and edge, by its kind (finding 321, a look in the iOS Simulator on 2026-11-27). The four fills were
 * the bright 500s, and the toast's white words read 2.15 to 3.76 to 1 on them, under the 4.5 to 1 small words need.
 * The words stay white, as they did when the orange (v2.6186), the press blue (v2.6218) and the press green
 * (v2.8364) were deepened. Each fill is deepened, and its edge steps one deeper so it still shows. The green and
 * the blue are the fills the presses already wear. Literal in both themes, as saturated status colours are.
 * `toastFills.test.ts` holds every kind at 4.5 to 1, so a new kind cannot come in pale.
 */
export type ToastKind = 'info' | 'warning' | 'error' | 'success'

/** The words on every toast. */
export const TOAST_WORDS = 'white'

export const TOAST_FILLS: Readonly<Record<ToastKind, { readonly bg: string; readonly border: string }>> = {
  info: { bg: '#2563eb', border: '#1d4ed8' },
  warning: { bg: '#b45309', border: '#92400e' },
  error: { bg: '#dc2626', border: '#b91c1c' },
  success: { bg: '#15803d', border: '#166534' },
}
