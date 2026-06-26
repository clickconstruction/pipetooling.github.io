import { writeContractPreviewEntry } from './contractBookPreviewHandoff'
import type { ContractBookExportEntry } from './contractRichTextDocument'

export type { ContractBookExportEntry }

/**
 * Open a Contract Book entry as a full-page preview in a new browser tab.
 *
 * Hands the entry to a real, same-origin app route (`/contract/book-preview`)
 * via a one-shot localStorage handoff, then opens that route in a new tab.
 *
 * Earlier versions generated a synthetic document and put the Download button
 * there — first `window.open('') + document.write` (tab stuck on `about:blank`),
 * then a `blob:` URL. Chromium-based browsers (Chrome, Brave) suppress downloads
 * initiated from those non-navigated `about:blank`/`blob:` contexts, so the
 * Download button failed. Rendering the preview as a normal app page means the
 * Download button runs in the real app origin, where downloads work.
 *
 * Synchronous (no `await` before `window.open`) so it stays user-gesture-
 * attributed and is not caught by popup blockers. No-op if storage is
 * unavailable (quota / private mode).
 */
export function openContractBookEntryPreview(entry: ContractBookExportEntry): void {
  const key = writeContractPreviewEntry(entry)
  if (!key) return
  const url = `${import.meta.env.BASE_URL}contract/book-preview?k=${encodeURIComponent(key)}`
  const win = window.open(url, '_blank')
  win?.focus()
}
