/**
 * GC mode, the real build, step 4: what New project's press sends (the prototype's
 * `NewProjectDraft`, branch spike/gc-mode), and the jsonb `gc_create_project(draft)` takes. The
 * window builds the draft; `draftForRpc` is the one place its field names are spelled for the
 * database (the role as the table has it, the size as a number).
 */
import type { CustomerRole, PlanSheet, ScopeExclusion, SpecSection } from './types'
import { customerRoleColumn } from './projectRows'

export interface NewTradeDraft {
  trade: string
  /** Our own number for the trade. 0 when none was typed. */
  budget: number
  /** We do this trade ourselves: its number comes from our own bid in Trades mode. */
  ours: boolean
  /** The scope lines, each a piece of work a quote says yes or no to. */
  scope: string[]
  /** The sheets each scope line reads from, in the order of `scope`. Missing: not said. */
  scopeSheets?: string[][]
  /** The sections of the project manual each scope line reads from, in the order of `scope`. */
  scopeSpecs?: string[][]
  /** Work the trade's quote leaves out, and who does it instead. */
  excludes?: ScopeExclusion[]
}

export interface NewProjectDraft {
  name: string
  address: string
  /** A customer record, or null for a company named for the first time in ownerName. */
  customerId: string | null
  ownerName: string
  /** A customer record too, or null for a firm named for the first time in architectName. */
  architectId: string | null
  architectName: string
  bidDue: string | null
  /** The size in square feet, as typed. Null: not given. */
  sqFt: number | null
  /** The words after the size: "clinic, one story". */
  sizeNote: string
  /** The first set of plans: what it is called, its kind, the day it came in, a line about it, its sheets. */
  setLabel: string
  setKind: string
  issuedOn: string
  setNote: string
  sheets: PlanSheet[]
  /** The project manual's sections, read from its table of contents. Missing or empty: none came in. */
  specs?: SpecSection[]
  trades: NewTradeDraft[]
  /** The first set's Google Drive link and its last check. Access null: not checked yet. */
  drive?: { url: string; access: 'anyone' | 'restricted' | null; checkedOn: string | null }
  /** The owner of the property when it is not the customer: a record, or null with a name for someone new. */
  propertyOwnerId?: string | null
  propertyOwnerName?: string
  /** Who we work for. Missing: the owner. */
  customerRole?: CustomerRole
}

/** The draft as `gc_create_project` reads it. */
export function draftForRpc(draft: NewProjectDraft): Record<string, unknown> {
  return {
    name: draft.name,
    address: draft.address,
    customerId: draft.customerId,
    ownerName: draft.ownerName,
    architectId: draft.architectId,
    architectName: draft.architectName,
    propertyOwnerId: draft.propertyOwnerId ?? null,
    propertyOwnerName: draft.propertyOwnerName ?? '',
    customerRole: customerRoleColumn(draft.customerRole),
    bidDue: draft.bidDue,
    sqFt: draft.sqFt,
    sizeNote: draft.sizeNote,
    setLabel: draft.setLabel,
    setKind: draft.setKind,
    issuedOn: draft.issuedOn,
    setNote: draft.setNote,
    drive: draft.drive ? { url: draft.drive.url, access: draft.drive.access, checkedOn: draft.drive.checkedOn } : null,
    sheets: draft.sheets,
    specs: draft.specs ?? [],
    trades: draft.trades.map((t) => ({
      trade: t.trade,
      budget: t.budget,
      ours: t.ours,
      scope: t.scope,
      scopeSheets: t.scopeSheets ?? null,
      scopeSpecs: t.scopeSpecs ?? null,
      excludes: t.excludes ?? [],
    })),
  }
}
