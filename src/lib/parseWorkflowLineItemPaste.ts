export type ParsedLineItemRow = { itemDate: string; memo: string; amount: number }

export type ParseWorkflowLineItemPasteResult =
  | { ok: true; rows: ParsedLineItemRow[] }
  | { ok: false; message: string }

/** Parse M/D/YYYY or MM/DD/YYYY into YYYY-MM-DD; returns null if invalid. */
function parseUsDateToIso(dateStr: string): string | null {
  const t = dateStr.trim()
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t)
  if (!m) return null
  const month = Number(m[1])
  const day = Number(m[2])
  const year = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1000 || year > 9999) return null
  const d = new Date(year, month - 1, day)
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

function parseAmount(cell: string): number | null {
  const cleaned = cell.replace(/\$/g, '').replace(/,/g, '').replace(/\s+/g, '').trim()
  if (cleaned === '') return null
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

/**
 * Tab-separated lines: date (M/D/YYYY), memo, amount ($ optional).
 * All-or-nothing: returns first parse error with 1-based line number.
 */
export function parseWorkflowLineItemPaste(text: string): ParseWorkflowLineItemPasteResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) {
    return { ok: false, message: 'Clipboard is empty or has no lines to import.' }
  }

  const rows: ParsedLineItemRow[] = []

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1
    const line = lines[i]
    if (line == null) continue
    const parts = line.split('\t').map((p) => p.trim())
    if (parts.length < 3) {
      return { ok: false, message: `Line ${lineNum}: expected date, memo, and amount separated by tabs.` }
    }
    const dateCell = parts[0] ?? ''
    const dateIso = parseUsDateToIso(dateCell)
    if (!dateIso) {
      return { ok: false, message: `Line ${lineNum}: invalid date "${dateCell}". Use M/D/YYYY (e.g. 3/23/2026).` }
    }
    const memo =
      parts.length === 3 ? (parts[1] ?? '') : parts.slice(1, -1).join('\t')
    if (!memo.trim()) {
      return { ok: false, message: `Line ${lineNum}: memo is required.` }
    }
    const amountRaw = parts[parts.length - 1] ?? ''
    const amount = parseAmount(amountRaw)
    if (amount === null) {
      return { ok: false, message: `Line ${lineNum}: invalid amount "${amountRaw}".` }
    }
    rows.push({ itemDate: dateIso, memo: memo.trim(), amount })
  }

  return { ok: true, rows }
}
