/**
 * Cross-browser Fullscreen API helpers (non-video elements). iOS often has limited support.
 */

type DocumentWithFs = Document & {
  webkitExitFullscreen?: () => Promise<void>
  msExitFullscreen?: () => Promise<void>
  webkitFullscreenElement?: Element | null
  msFullscreenElement?: Element | null
}

type ElementWithFs = HTMLElement & {
  webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void>
  msRequestFullscreen?: (options?: FullscreenOptions) => Promise<void>
}

export function isDomFullscreenEnabled(): boolean {
  if (typeof document === 'undefined') return false
  const d = document as Document & { webkitFullscreenEnabled?: boolean }
  if (d.fullscreenEnabled) return true
  if (d.webkitFullscreenEnabled) return true
  return false
}

export function getCurrentFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null
  const d = document as DocumentWithFs
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? d.msFullscreenElement ?? null
}

export async function requestElementFullscreen(element: HTMLElement): Promise<void> {
  const el = element as ElementWithFs
  if (el.requestFullscreen) {
    await el.requestFullscreen()
    return
  }
  if (el.webkitRequestFullscreen) {
    await el.webkitRequestFullscreen()
    return
  }
  if (el.msRequestFullscreen) {
    await el.msRequestFullscreen()
    return
  }
  throw new Error('Fullscreen API not available for this element')
}

export async function exitDomFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return
  const d = document as DocumentWithFs
  if (d.fullscreenElement == null && d.webkitFullscreenElement == null && d.msFullscreenElement == null) {
    return
  }
  if (d.exitFullscreen) {
    await d.exitFullscreen()
    return
  }
  if (d.webkitExitFullscreen) {
    await d.webkitExitFullscreen()
    return
  }
  if (d.msExitFullscreen) {
    await d.msExitFullscreen()
  }
}
