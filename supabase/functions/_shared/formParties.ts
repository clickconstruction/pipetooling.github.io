/**
 * Two-party forms — the office's queue and the regions each party owns
 * (Contract Forms PR 8). Pure; the Contracts tab, the Person Desk, the signing
 * page, and the office modal all read from here.
 */

import { partyOf, type FormParty, type FormRect, type FormSchema } from './formSchema.ts'

export type PartyRegion = { page: number; rect: FormRect }

/**
 * One bounding rect per page for a party's boxes, padded a little so the
 * shading reads as a band rather than a tight outline. The signing page hatches
 * the office's regions ("completed by the office"); the office modal shades the
 * signer's ("signed by the employee · locked").
 */
export function partyRegions(schema: FormSchema, party: FormParty, pad = 4): PartyRegion[] {
  const byPage = new Map<number, FormRect>()
  for (const b of schema.boxes) {
    if (partyOf(b) !== party) continue
    const r = byPage.get(b.page)
    if (!r) byPage.set(b.page, { ...b.rect })
    else {
      const x = Math.min(r.x, b.rect.x)
      const y = Math.min(r.y, b.rect.y)
      const right = Math.max(r.x + r.w, b.rect.x + b.rect.w)
      const top = Math.max(r.y + r.h, b.rect.y + b.rect.h)
      byPage.set(b.page, { x, y, w: right - x, h: top - y })
    }
  }
  return [...byPage.entries()]
    .map(([page, r]) => {
      const pg = schema.pages[page - 1]
      const x = Math.max(0, r.x - pad)
      const y = Math.max(0, r.y - pad)
      const right = pg ? Math.min(pg.width, r.x + r.w + pad) : r.x + r.w + pad
      const top = pg ? Math.min(pg.height, r.y + r.h + pad) : r.y + r.h + pad
      return { page, rect: { x, y, w: right - x, h: top - y } }
    })
    .sort((a, b) => a.page - b.page)
}

export type OfficeQueueRowInput = {
  id: string
  person_name: string
  document_name: string
  status: string
  signed_at: string | null
  form_template_id?: string | null
  office_completed_at?: string | null
}

/** A signed two-party form the office has not completed yet. */
export function officeSectionPending(row: OfficeQueueRowInput, twoPartyTemplateIds: ReadonlySet<string>): boolean {
  return row.status === 'signed' && !!row.form_template_id && twoPartyTemplateIds.has(row.form_template_id) && !row.office_completed_at
}

export type OfficeQueueItem = { id: string; personName: string; documentName: string; signedAt: string | null }

/** Everything waiting on the office, oldest signature first. */
export function officeQueue(rows: readonly OfficeQueueRowInput[], twoPartyTemplateIds: ReadonlySet<string>): OfficeQueueItem[] {
  return rows
    .filter((r) => officeSectionPending(r, twoPartyTemplateIds))
    .map((r) => ({ id: r.id, personName: r.person_name, documentName: r.document_name, signedAt: r.signed_at }))
    .sort((a, b) => (a.signedAt ?? '').localeCompare(b.signedAt ?? '') || a.personName.localeCompare(b.personName))
}

/** Template ids whose schema has office boxes. */
export function twoPartyTemplateIdSet(templates: ReadonlyArray<{ id: string; schema: FormSchema | null }>): Set<string> {
  const out = new Set<string>()
  for (const t of templates) if (t.schema?.boxes.some((b) => partyOf(b) === 'office')) out.add(t.id)
  return out
}

/** The generic office attestation shown above the complete button (the form's own certification is on the page). */
export const OFFICE_ATTESTATION =
  'I attest, under penalty of perjury, that I have examined the documents this section describes, that the information I entered is true and correct, and that my typed name below is my signature.'
