/**
 * Shared window.open print glue for the Jobs print builders (Stage A of the
 * Jobs.tsx decomposition — see docs/JOBS_TABS_ARCHITECTURE.md).
 *
 * Returns false when the popup was blocked so callers can toast (or not — the
 * sub-sheet printers historically fail silently; keep that per call site).
 */
export function openHtmlPrintWindow(html: string): boolean {
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.write(html)
  win.document.close()
  win.focus()
  const print = () => {
    win.print()
    win.onafterprint = () => win.close()
  }
  // A page with no picture still loading prints at once, as it always did.
  const waiting = picturesStillLoading(win)
  if (waiting.length === 0) print()
  else void whenPicturesSettle(waiting).then(print)
  return true
}

/** The longest a print waits on its pictures, in milliseconds. A picture that never arrives must not lose the print. */
export const PRINT_PICTURE_WAIT_MS = 3000

/**
 * The page's pictures that have not finished loading. A picture written into a new window is not loaded yet when the
 * write returns, even one carried in the page itself as a `data:` address, and a page printed at that moment draws an
 * empty box where the picture belongs (the codes on the lien help sheets, v2.7011).
 */
function picturesStillLoading(win: Window): HTMLImageElement[] {
  return Array.from(win.document.images ?? []).filter((img) => !img.complete)
}

/** Settles once every picture has loaded or failed, or after `PRINT_PICTURE_WAIT_MS`, whichever comes first. */
function whenPicturesSettle(imgs: HTMLImageElement[]): Promise<void> {
  const each = imgs.map(
    (img) =>
      new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true })
        img.addEventListener('error', () => resolve(), { once: true })
      }),
  )
  return Promise.race([Promise.all(each).then(() => undefined), new Promise<void>((resolve) => setTimeout(resolve, PRINT_PICTURE_WAIT_MS))])
}

/**
 * Same window.open glue WITHOUT triggering print — for read-only previews
 * (the lien papers, the job agreement). Same popup-blocked contract as
 * openHtmlPrintWindow. GC Review's email previews left it for the in-app
 * EmailPreviewOverlay (v2.4250).
 */
export function openHtmlPreviewWindow(html: string): boolean {
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.write(html)
  win.document.close()
  win.focus()
  return true
}

/**
 * Like openHtmlPreviewWindow / openHtmlPrintWindow, for a page that needs a moment to build (a
 * signed lien waiver reads its stored signature first, v2.4335): the window opens at once — inside
 * the click, so popup blockers allow it — with a short "Loading" line, then takes the finished
 * page. With `print`, it waits for the page's pictures before printing so the ink is on the sheet.
 * False when the popup was blocked or the page could not be built (the window is closed then).
 */
export async function openHtmlWindowWhenReady(build: () => Promise<string>, opts: { print?: boolean } = {}): Promise<boolean> {
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Loading…</title></head><body style="font:14px system-ui,sans-serif;margin:2rem;color:#4b5563">Loading the page…</body></html>')
  win.document.close()
  let html: string
  try {
    html = await build()
  } catch {
    win.close()
    return false
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  if (opts.print) {
    await whenPicturesSettle(picturesStillLoading(win))
    win.print()
    win.onafterprint = () => win.close()
  }
  return true
}
