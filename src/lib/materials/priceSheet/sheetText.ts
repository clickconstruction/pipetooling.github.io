/**
 * A price sheet's file as text (punch list #308, PR 4). A PDF a supply house's system made carries
 * its own text layer, which costs nothing to read and has every digit right; `parsePasted` then reads
 * that text as rows. A scan or a photo has no text and waits for the reader that looks at the picture.
 */
import { pageMark } from './pastedRow'

export type TextItem = { x: number; y: number; str: string }

/**
 * One page's text items as printed lines, top to bottom, each left to right. PDF text has no line
 * breaks: items within a few points of the same height are one line.
 */
export function linesFromTextItems(items: TextItem[], tolerance = 3): string[] {
  const sorted = items.filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: TextItem[][] = []
  let lineY: number | null = null
  for (const item of sorted) {
    if (lineY == null || Math.abs(item.y - lineY) > tolerance) {
      lines.push([item])
      lineY = item.y
    } else lines[lines.length - 1]!.push(item)
  }
  return lines.map((l) => l.sort((a, b) => a.x - b.x).map((i) => i.str.trim()).join('  ').trim()).filter(Boolean)
}

/** Pages of lines as one text, each page opened by its mark so rows know their page. */
export function textFromPages(pages: string[][]): string {
  return pages.map((lines, i) => [pageMark(i + 1), ...lines].join('\n')).join('\n')
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export type SheetRead =
  | { ok: true; text: string; pages: number; sha256: string; fileName: string }
  /** `needsReader`: the file is a picture of a sheet, with no text to read. */
  | { ok: false; error: string; needsReader: boolean }

/** A dropped or picked file as text. Browser only: the PDF is opened with pdf.js. */
export async function readSheetFile(file: File): Promise<SheetRead> {
  const name = file.name.toLowerCase()
  try {
    const bytes = await file.arrayBuffer()
    const sha256 = await sha256Hex(bytes)
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      const { getPdfDocument } = await import('../../pdfjsDocument')
      const doc = await getPdfDocument(bytes)
      const pages: string[][] = []
      for (let p = 1; p <= Math.min(doc.numPages, 40); p++) {
        const page = await doc.getPage(p)
        const content = await page.getTextContent()
        const items: TextItem[] = []
        for (const item of content.items) {
          if (!('str' in item)) continue
          items.push({ x: Number(item.transform?.[4] ?? 0), y: Number(item.transform?.[5] ?? 0), str: item.str })
        }
        pages.push(linesFromTextItems(items))
      }
      const text = textFromPages(pages)
      if (text.replace(/[\s\f\d]/g, '').length < 40) {
        return { ok: false, needsReader: true, error: 'This PDF is a picture of a sheet, with no text to read. Paste its rows as text for now.' }
      }
      return { ok: true, text, pages: pages.length, sha256, fileName: file.name }
    }
    if (name.endsWith('.txt') || name.endsWith('.csv') || file.type.startsWith('text/')) {
      const text = new TextDecoder().decode(bytes)
      if (!text.trim()) return { ok: false, needsReader: false, error: 'That file came out empty.' }
      return { ok: true, text, pages: 1, sha256, fileName: file.name }
    }
    if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|heic|gif)$/.test(name)) {
      return { ok: false, needsReader: true, error: 'A photo or a screenshot has no text to read yet. Paste its rows as text for now.' }
    }
    return { ok: false, needsReader: false, error: 'Drop a PDF or a text file, or paste the rows.' }
  } catch (e) {
    return { ok: false, needsReader: false, error: `That file could not be read: ${e instanceof Error ? e.message : 'it would not open'}` }
  }
}
