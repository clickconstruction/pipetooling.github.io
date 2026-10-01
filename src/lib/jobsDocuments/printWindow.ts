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
  win.print()
  win.onafterprint = () => win.close()
  return true
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
    const imgs = Array.from(win.document.images ?? [])
    await Promise.all(
      imgs.map((img) =>
        img.complete
          ? null
          : new Promise<void>((resolve) => {
              img.onload = () => resolve()
              img.onerror = () => resolve()
            }),
      ),
    )
    win.print()
    win.onafterprint = () => win.close()
  }
  return true
}
