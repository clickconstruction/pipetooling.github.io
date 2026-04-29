/**
 * HTML table / block content to CSV for export (e.g. modal body with one or more tables).
 * Prefers tabular extraction; falls back to plain text lines when there are no tables.
 */

/** RFC 4180-style field escaping for Excel. */
export function escapeCsvField(s: string): string {
  const t = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (/[",\n]/.test(t)) {
    return `"${t.replace(/"/g, '""')}"`
  }
  return t
}

function rowToCsvLine(tr: HTMLTableRowElement): string {
  const cells = tr.querySelectorAll(':scope > th, :scope > td')
  if (cells.length === 0) return ''
  return Array.from(cells)
    .map((c) => escapeCsvField(c.textContent?.trim() ?? ''))
    .join(',')
}

/** Top-level rows only (not nested tables inside cells). */
function rowsOfTable(table: HTMLTableElement): HTMLTableRowElement[] {
  const out: HTMLTableRowElement[] = []
  const add = (section: HTMLTableSectionElement | null) => {
    if (!section) return
    for (const row of Array.from(section.rows)) {
      out.push(row)
    }
  }
  add(table.tHead)
  for (const tb of Array.from(table.tBodies)) {
    add(tb)
  }
  add(table.tFoot)
  return out
}

function tableToCsvLines(table: HTMLTableElement): string[] {
  return rowsOfTable(table)
    .map((tr) => rowToCsvLine(tr))
    .filter((line) => line.length > 0)
}

export type ElementToLikelyCsvOptions = {
  /** Prepended as first row: Title,<title> */
  title?: string
}

/**
 * Walks `table` elements in tree order (depth-first). Each table becomes a block of CSV lines;
 * multiple tables are separated by a blank line. If there are no tables, exports a two-column
 * text fallback (line / value) from visible text.
 */
export function elementToLikelyCsv(root: HTMLElement, options?: ElementToLikelyCsvOptions): string {
  const parts: string[] = []
  if (options?.title) {
    parts.push(`${escapeCsvField('Title')},${escapeCsvField(options.title)}`)
  }

  const tables = root.querySelectorAll('table')
  if (tables.length === 0) {
    const text = (root.innerText ?? root.textContent ?? '').replace(/\u00a0/g, ' ').trim()
    if (!text) {
      parts.push(`${escapeCsvField('Note')},${escapeCsvField('No tabular data in this view.')}`)
    } else {
      const lines = text
        .split(/\n+/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
      if (lines.length === 0) {
        parts.push(`${escapeCsvField('Note')},${escapeCsvField('No tabular data in this view.')}`)
      } else {
        for (const line of lines) {
          parts.push(`${escapeCsvField('Text')},${escapeCsvField(line)}`)
        }
      }
    }
    return `\uFEFF${parts.join('\n')}\n`
  }

  tables.forEach((table, i) => {
    if (i > 0) {
      parts.push('')
    }
    parts.push(...tableToCsvLines(table as HTMLTableElement))
  })
  return `\uFEFF${parts.join('\n')}\n`
}

/** Safe filename segment (ASCII-ish) for downloads. */
export function sanitizeFilenameSegment(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'breakdown'
}
