/**
 * What the estimate editor holds after a save reads the row back (punch list #46 row 3, the
 * Estimates map's "A quiet reload").
 *
 * A save used to blank the page and seed the whole editor again from the row. The page now stays
 * up, so the read-back lands on an editor somebody may still be typing in. Three forms meet:
 *
 * - `sent`   — the editor as the save wrote it;
 * - `now`    — the editor on screen when the read lands;
 * - `server` — the editor the row would open as (`estimateServerFormFromRow`).
 *
 * The rule, field by field:
 *
 * - **Untouched since the save** (`now` equals `sent`): the server's value arrives. That is how a
 *   trimmed title, the default good-through date, the stub line of an empty estimate and a value
 *   somebody else wrote reach the screen.
 * - **Typed since the save** (`now` differs from `sent`): the typing stays. It is newer than the
 *   row, and the autosave writes it next, because the baseline it compares against is the
 *   `settled` form below and not the screen.
 * - **Both moved**: the typing still stays and the next save writes over the row. A draft save has
 *   always written the whole form, so the last save wins, as it did before.
 * - **A date caught half typed** was left out of the write (`estimateDraftPersist`), so the row
 *   still holds the old one. The box keeps what is typed. On a change order the whole of
 *   `coFields` waited with its date, so the whole of it stays.
 *
 * Four fields are the screen's own and no save writes them. Each follows what it describes:
 * the viewed option stays the one being viewed while it still exists; the Page preview's ticks
 * stay while every ticked option still exists; the lit good-through preset follows its date; the
 * customer box keeps its text unless the read changed who the customer is.
 *
 * Nothing is minted by the write: lines are a JSON snapshot with no ids, and an option's key is
 * made in the browser. No trigger rewrites a draft's fields either. So what the server "changes"
 * is what the row's own hydration changes, and that is why the server's form is built by the same
 * code that opens a row.
 */
import type { Tables } from '../../types/database'
import type { ValidUntilPresetDays } from '../addCalendarDaysYmd'
import { extractContactFromCustomer, type CustomerRow } from '../customerContactDisplay'
import type { EstimateAcceptHeaderBrand } from '../estimateAcceptHeaderBrand'
import type { EstimateChangeOrderFields } from '../estimateChangeOrder'
import { normalizeCustomerAttachmentDraftForDb } from '../estimateCustomerAttachment'
import { parseEstimateExperienceOverrides, type EstimateExperienceOverrideKey } from '../estimateCustomerExperience'
import { sumNormalizedLineItems, type EstimateLineItemNormalized } from '../estimateLineItemNormalize'
import { customerFieldsFromEstimate, estimateFormFromRow, estimateInitialTitle } from './estimateDetailHydration'
import { buildEstimateDraftPersistPayload, estimateDraftUnfinishedDates, type EstimateDraftPersistPayload } from './estimateDraftPersist'
import type { EstimateOption } from './estimateOptions'
import { switchViewedEstimateOption } from './estimateOptionsEditor'
import { estimateRecipientEmail } from './estimateSendPlan'

/** The draft editor's form: every piece of state a row seeds and a save reads. */
export interface EstimateEditorForm {
  title: string
  terms: string
  /** The viewed option's lines while options exist, else the estimate's. */
  lines: EstimateLineItemNormalized[]
  options: EstimateOption[]
  viewedOptionKey: string | null
  previewSelectedOptionKeys: string[]
  coFields: EstimateChangeOrderFields
  customerId: string | null
  customerSearch: string
  sendEmailOverride: string
  validUntil: string
  validUntilPreset: ValidUntilPresetDays | null
  forAddress: string
  linkedProjectId: string
  internalNotes: string
  attachmentUrl: string
  attachmentLabel: string
  acceptHeaderBrand: EstimateAcceptHeaderBrand | null
  cxOverrideFields: Partial<Record<EstimateExperienceOverrideKey, string>>
  acceptNotifyUserIds: string[]
}

export type EstimateEditorFormKey = keyof EstimateEditorForm

/** The form a row would open as. The notify list is null on a draft that has never had one: the page keeps its own. */
export type EstimateServerForm = Omit<EstimateEditorForm, 'acceptNotifyUserIds'> & { acceptNotifyUserIds: string[] | null }

type EstimateRowForEditor = Parameters<typeof estimateFormFromRow>[0] & Pick<Tables<'estimates'>, 'title' | 'customer_email' | 'customer_experience_overrides'>
type CustomerForEditor = Pick<CustomerRow, 'id' | 'name' | 'address' | 'contact_info'>

/** The editor a row would open as, by the rules `load()` opens it with (`estimateDetailHydration`). */
export function estimateServerFormFromRow(row: EstimateRowForEditor, customers: ReadonlyArray<CustomerForEditor>, today: Date = new Date()): EstimateServerForm {
  const form = estimateFormFromRow(row, today)
  const customer = customerFieldsFromEstimate(row, customers)
  return {
    title: estimateInitialTitle(row, customers),
    terms: form.terms,
    lines: form.lines,
    options: form.options,
    viewedOptionKey: form.viewedOptionKey,
    previewSelectedOptionKeys: form.previewSelectedOptionKeys,
    coFields: form.coFields,
    customerId: form.customerId,
    customerSearch: customer.customerSearch,
    sendEmailOverride: customer.sendEmailOverride,
    validUntil: form.validUntil,
    validUntilPreset: form.validUntilPreset,
    forAddress: form.forAddress,
    linkedProjectId: form.linkedProjectId,
    internalNotes: form.internalNotes,
    attachmentUrl: form.attachmentUrl,
    attachmentLabel: form.attachmentLabel,
    acceptHeaderBrand: form.acceptHeaderBrand,
    cxOverrideFields: parseEstimateExperienceOverrides(row.customer_experience_overrides),
    acceptNotifyUserIds: form.acceptNotifyIds === 'draft-default' ? null : form.acceptNotifyIds,
  }
}

/**
 * The draft's UPDATE payload for a form. One builder for the save, the autosave's dirty check and
 * the baseline a save hands the autosave, so "dirty" can never disagree with what a save writes.
 * The address an estimate goes to is the customer's own, else the one typed under Send to.
 */
export function estimateDraftPayloadOfForm(form: EstimateEditorForm, ctx: { isChangeOrder: boolean; customers: ReadonlyArray<Pick<CustomerRow, 'id' | 'contact_info'>> }): EstimateDraftPersistPayload {
  const selected = form.customerId ? ctx.customers.find((c) => c.id === form.customerId) : undefined
  const crmEmail = selected ? extractContactFromCustomer(selected).email.trim() : ''
  const overrides = parseEstimateExperienceOverrides(form.cxOverrideFields)
  return buildEstimateDraftPersistPayload(
    {
      isChangeOrder: ctx.isChangeOrder,
      title: form.title,
      terms: form.terms,
      lines: form.lines,
      totalCents: sumNormalizedLineItems(form.lines),
      options: form.options,
      viewedOptionKey: form.viewedOptionKey,
      validUntil: form.validUntil,
      forAddress: form.forAddress,
      linkedProjectId: form.linkedProjectId,
      internalNotes: form.internalNotes,
      customerId: form.customerId,
      customerEmail: form.customerId ? estimateRecipientEmail(crmEmail, form.sendEmailOverride) || null : null,
      customerExperienceOverrides: Object.keys(overrides).length > 0 ? overrides : null,
      acceptHeaderBrand: form.acceptHeaderBrand,
      acceptNotifyUserIds: form.acceptNotifyUserIds,
      changeOrderFields: form.coFields,
    },
    normalizeCustomerAttachmentDraftForDb(form.attachmentUrl, form.attachmentLabel),
  )
}

export interface EstimateFormReseed {
  /** What the editor holds now. A field the read did not move is the screen's own value, by reference. */
  form: EstimateEditorForm
  /** The fields whose value moved: the only ones the page sets. */
  changed: EstimateEditorFormKey[]
  /** The saved fields typed in since the save. The row does not hold them yet. */
  typedSince: EstimateEditorFormKey[]
}

/** The fields that follow one rule: the server's value unless typed since the save. */
const PLAIN_KEYS = ['title', 'terms', 'forAddress', 'linkedProjectId', 'internalNotes', 'attachmentUrl', 'attachmentLabel', 'acceptHeaderBrand', 'cxOverrideFields', 'sendEmailOverride', 'customerId'] as const

/** The fields a save writes, in the order the page shows them. The other four are the screen's own. */
const SAVED_KEYS: readonly EstimateEditorFormKey[] = ['customerId', 'sendEmailOverride', 'title', 'options', 'lines', 'coFields', 'validUntil', 'forAddress', 'terms', 'attachmentUrl', 'attachmentLabel', 'acceptHeaderBrand', 'cxOverrideFields', 'acceptNotifyUserIds', 'linkedProjectId', 'internalNotes']

const ALL_KEYS: readonly EstimateEditorFormKey[] = [...SAVED_KEYS, 'viewedOptionKey', 'previewSelectedOptionKeys', 'validUntilPreset', 'customerSearch']

const same = (a: unknown, b: unknown): boolean => a === b || JSON.stringify(a) === JSON.stringify(b)

/** The editor after a save's read-back: see the rule at the top of this file. */
export function reseedEstimateFormAfterSave(input: { sent: EstimateEditorForm; now: EstimateEditorForm; server: EstimateServerForm; isChangeOrder: boolean }): EstimateFormReseed {
  const { sent, now, server } = input
  const typed = (key: EstimateEditorFormKey) => !same(now[key], sent[key])
  const held = estimateDraftUnfinishedDates({ isChangeOrder: input.isChangeOrder, validUntil: sent.validUntil, changeOrderFields: sent.coFields })
  const next: EstimateEditorForm = { ...now }
  // None of these is nullable on the row's form, so the row's value is the editor's type as it stands.
  for (const key of PLAIN_KEYS) if (!typed(key)) Object.assign(next, { [key]: server[key] })

  if (!typed('acceptNotifyUserIds') && server.acceptNotifyUserIds !== null) next.acceptNotifyUserIds = server.acceptNotifyUserIds

  // A half-typed date was left out of the write: the box keeps it, and its preset with it.
  if (!typed('validUntil') && !held.includes('valid_until')) {
    next.validUntil = server.validUntil
    next.validUntilPreset = server.validUntilPreset
  }
  if (!typed('coFields') && !held.includes('response_requested_by')) next.coFields = server.coFields

  // The options, the viewed one and its lines move together: `lines` is the viewed option's.
  if (!typed('options') && !typed('viewedOptionKey') && !typed('lines')) {
    const opened = { options: server.options, viewedKey: server.viewedOptionKey, lines: server.lines, previewSelected: server.previewSelectedOptionKeys }
    const viewing = now.viewedOptionKey ? switchViewedEstimateOption(opened, now.viewedOptionKey) : opened
    next.options = viewing.options
    next.viewedOptionKey = viewing.viewedKey
    next.lines = viewing.lines
  }
  const offered = new Set(next.options.map((o) => o.key))
  if (!now.previewSelectedOptionKeys.every((key) => offered.has(key))) next.previewSelectedOptionKeys = server.previewSelectedOptionKeys

  // The customer box is text being typed until a customer is picked: it moves only with the customer.
  if (next.customerId !== now.customerId) next.customerSearch = server.customerSearch

  const changed: EstimateEditorFormKey[] = []
  const form = { ...next }
  for (const key of ALL_KEYS) {
    if (same(next[key], now[key])) Object.assign(form, { [key]: now[key] })
    else changed.push(key)
  }
  return { form, changed, typedSince: SAVED_KEYS.filter(typed) }
}

/**
 * The editor as the read-back leaves it when nothing was typed since the save. Its payload is the
 * autosave's baseline after a save: the screen equals it when nobody typed, and differs from it by
 * exactly what was typed when somebody did.
 */
export function settledEstimateFormAfterSave(input: { sent: EstimateEditorForm; server: EstimateServerForm; isChangeOrder: boolean }): EstimateEditorForm {
  return reseedEstimateFormAfterSave({ sent: input.sent, now: input.sent, server: input.server, isChangeOrder: input.isChangeOrder }).form
}
