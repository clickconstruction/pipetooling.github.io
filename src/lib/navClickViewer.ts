/**
 * The signed-in viewer for press telemetry (v2.5904, punch list #190 PR 1). The auth provider
 * installs it at sign-in, beside the refused-write identity and the error-shown sink, so a leaf
 * control (a Call button, a Pipeline row, the job window's bar) records a press without reading
 * auth while it renders: a render smoke that mocks the auth hook never meets it, and a press
 * records the viewer of that moment. Signed out, the viewer is empty and nothing is written.
 */
import { CALL_PRESSED_CONTROL, callPressedTarget, recordNavClick, recordNavClickFromEvent } from './navClickTelemetry'

type Viewer = { userId: string | null; role: string | null }

let viewer: Viewer = { userId: null, role: null }

/** Set by the auth provider on every sign-in, role change and sign-out. */
export function setNavClickViewer(userId: string | null | undefined, role: string | null | undefined): void {
  viewer = { userId: userId ?? null, role: role ?? null }
}

/** The viewer a press is recorded as. */
export function navClickViewer(): Viewer {
  return { ...viewer }
}

/**
 * Capture-phase listener for tracked chrome: the clicked link or labelled button, recorded as
 * the viewer. A measurement never breaks a press, so anything it throws is dropped.
 */
export function recordViewerNavClick(e: { target: EventTarget | null }): void {
  try {
    recordNavClickFromEvent(viewer.userId, viewer.role, e)
  } catch {
    /* measurement is best-effort by design */
  }
}

/** One `call_pressed{#surface=<site>}` row for a Call press on a site the resolver cannot see (a sheet, a thread). */
export function recordCallPressed(site: string): void {
  try {
    recordNavClick(viewer.userId, viewer.role, CALL_PRESSED_CONTROL, callPressedTarget(site))
  } catch {
    /* measurement is best-effort by design */
  }
}
