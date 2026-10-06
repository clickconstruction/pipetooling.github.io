// @vitest-environment jsdom
/**
 * Who signs is picked per opening (v2.4567): Jobs → Stages keeps this modal mounted, so a leader
 * picked for one job stayed the pick on the next. Each job now opens on its own default.
 *
 * A row that was asked keeps its own leader (#87 M): a resumed signature request opens with the
 * leader it asked in the Signs pick, after a reload or a reopen in the same session, and He signs
 * now leaves the request with him.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import LienReleaseModal from './LienReleaseModal'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'assistant-1' }, role: 'assistant', profileName: 'Taunya' }) }))
// jsdom draws nothing: the line's canvas gets no 2D context (and no "not implemented" noise).
HTMLCanvasElement.prototype.getContext = (() => null) as never
// He signs now opens the pad: jsdom has no canvas, so the pad is a stub (as in the ink test).
vi.mock('signature_pad', () => ({
  default: class {
    off() {}
    clear() {}
    isEmpty() {
      return true
    }
    toDataURL() {
      return null
    }
  },
}))

/**
 * The releases the window reads on open (each read sees its own job's rows, and a read can be held
 * back to come in late), every update written to them, and whether Robert Douglas has been archived.
 */
const db = vi.hoisted(() => ({
  releases: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>,
  hold: {} as Record<string, Promise<void>>,
  master2Archived: false,
}))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as { from: (t: string) => unknown }
  const realFrom = stub.from.bind(stub)
  stub.from = (table: string) => {
    if (table === 'job_lien_releases') {
      const builder: Record<string, unknown> = {}
      let jobId: string | null = null
      for (const m of ['select', 'order', 'in', 'is', 'limit', 'insert']) builder[m] = () => builder
      builder.eq = (col: string, v: unknown) => {
        if (col === 'job_id') jobId = String(v)
        return builder
      }
      builder.update = (payload: Record<string, unknown>) => {
        db.updates.push(payload)
        return builder
      }
      builder.single = () => Promise.resolve({ data: { ...(db.releases[0] ?? {}), ...(db.updates[db.updates.length - 1] ?? {}) }, error: null })
      builder.maybeSingle = builder.single
      builder.then = (ok: (v: unknown) => unknown) =>
        Promise.resolve(jobId ? db.hold[jobId] : undefined)
          .then(() => ({ data: jobId ? db.releases.filter((r) => r.job_id === jobId) : db.releases, error: null }))
          .then(ok)
      return builder
    }
    if (table !== 'users') return realFrom(table)
    const users = () => [
      { id: 'master-1', name: 'Malachi Reyes', notes: null, archived_at: null },
      { id: 'master-2', name: 'Robert Douglas', notes: null, archived_at: db.master2Archived ? '2026-10-06T00:00:00Z' : null },
      { id: 'master-3', name: 'Dana Whites', notes: null, archived_at: null },
    ]
    const builder: Record<string, unknown> = {}
    let byId: string | null = null
    for (const m of ['select', 'order', 'in', 'is', 'limit']) builder[m] = () => builder
    builder.eq = (col: string, v: unknown) => {
      if (col === 'id') byId = String(v)
      return builder
    }
    // one person by id (a leader asked before he was archived): archived rows included
    builder.maybeSingle = () => Promise.resolve({ data: users().find((u) => u.id === byId) ?? null, error: null })
    builder.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: users(), error: null }).then(ok)
    return builder
  }
  return { supabase: stub }
})

const jobFor = (id: string, masterId: string) => {
  const inv = makeInvoice({ id: `inv-${id}`, status: 'billed', amount: 11240, sequence_order: 0 })
  return { job: makeJob({ id, hcp_number: id, job_name: `Job ${id}`, master_user_id: masterId, invoices: [inv], revenue: 36000 }), inv }
}
const a = jobFor('j1', 'master-1')
const b = jobFor('j2', 'master-1')
const c = jobFor('j3', 'master-2')
/** A job whose own leader is not on the leaders list. */
const offList = jobFor('j9', 'master-9')

const whoSigns = () => within(screen.getByTestId('lien-waiver-signer')).getByLabelText('Who signs') as HTMLSelectElement
const opened = async (value: string) => {
  await screen.findByTestId('lien-waiver-signer')
  await settle()
  await waitFor(() => expect(whoSigns().value).toBe(value))
}

beforeEach(() => {
  db.releases = []
  db.updates = []
  db.hold = {}
  db.master2Archived = false
})
afterEach(cleanup)

/** Job 1's waiver, asked of Robert Douglas — not the job's own leader, Malachi Reyes. */
const askedOfMaster2 = {
  id: 'rel-1',
  job_id: 'j1',
  status: 'awaiting_signature',
  form_type: 'conditional_progress',
  invoice_ids: ['inv-j1'],
  amount: 11240,
  through_date: '2026-09-30',
  signed_date: null,
  fields: { companyName: 'Click Plumbing', checkFrom: 'Summit GC', amount: '11240.00', projectDescription: 'Job j1', throughDate: '2026-09-30', signedDate: '', signerName: 'Robert Douglas', signerTitle: 'Owner' },
  voided_at: null,
  minted_at: '2026-10-05T15:00:00Z',
  created_at: '2026-10-05T14:00:00Z',
  signature_requested_at: '2026-10-05T15:00:00Z',
  signature_requested_by: 'assistant-1',
  signer_user_id: 'master-2',
  signed_on_device_of: null,
}

describe('LienReleaseModal — who signs resets with the job (v2.4567)', () => {
  it('a leader picked on one job is not the pick when the modal reopens on the next', async () => {
    const view = renderWithProviders(<LienReleaseModal signerNameFallback="Malachi Reyes" open onClose={() => undefined} job={a.job} invoice={a.inv} />)
    await opened('master-1')
    fireEvent.change(whoSigns(), { target: { value: 'master-2' } })
    expect(whoSigns().value).toBe('master-2')

    // Jobs → Stages closes it without unmounting, then opens it on another job.
    view.rerender(<LienReleaseModal signerNameFallback="Malachi Reyes" open={false} onClose={() => undefined} job={null} invoice={null} />)
    await settle()
    view.rerender(<LienReleaseModal signerNameFallback="Malachi Reyes" open onClose={() => undefined} job={b.job} invoice={b.inv} />)
    await opened('master-1')

    // Reopening the same job starts from its default too.
    fireEvent.change(whoSigns(), { target: { value: 'master-2' } })
    view.rerender(<LienReleaseModal signerNameFallback="Malachi Reyes" open={false} onClose={() => undefined} job={null} invoice={null} />)
    await settle()
    view.rerender(<LienReleaseModal signerNameFallback="Malachi Reyes" open onClose={() => undefined} job={b.job} invoice={b.inv} />)
    await opened('master-1')
  })

  it('a job swapped under the open modal takes its own leader', async () => {
    const view = renderWithProviders(<LienReleaseModal signerNameFallback="Malachi Reyes" open onClose={() => undefined} job={a.job} invoice={a.inv} />)
    await opened('master-1')
    view.rerender(<LienReleaseModal signerNameFallback="Malachi Reyes" open onClose={() => undefined} job={c.job} invoice={c.inv} />)
    await opened('master-2')
  })

  it('#87 M · a request asked of another leader resumes with him in the pick, after a reload', async () => {
    db.releases = [askedOfMaster2]
    renderWithProviders(<LienReleaseModal signerNameFallback="Malachi Reyes" open onClose={() => undefined} job={a.job} invoice={a.inv} />)
    await opened('master-2')
    expect(whoSigns().disabled).toBe(true)
    expect(screen.getByText('✍ Waiting for Robert Douglas to sign')).toBeTruthy()
    // He signs now leaves the request with him: the pad is his to draw on, and nothing renames the signer.
    fireEvent.click(screen.getByTestId('lien-waiver-sign-now'))
    expect(await screen.findByText('Robert Douglas signs here — Job j1')).toBeTruthy()
    expect(db.updates.filter((u) => 'signer_user_id' in u)).toEqual([])
  })

  it('#87 M · a leader archived since he was asked stays the one who signs, named from his own row', async () => {
    db.master2Archived = true
    // the page's Signed by line prints someone else: the leader asked is still Robert
    db.releases = [{ ...askedOfMaster2, fields: { ...askedOfMaster2.fields, signerName: 'Taunya' } }]
    renderWithProviders(<LienReleaseModal signerNameFallback="Malachi Reyes" open onClose={() => undefined} job={a.job} invoice={a.inv} />)
    await opened('master-2')
    // the pick keeps a line for him, under his own name
    await waitFor(() => expect(whoSigns().selectedOptions[0]?.textContent).toBe('Robert Douglas'))
    // the pad is his and is drawn on: it never opens for the signed-in user to sign in his place
    fireEvent.click(screen.getByTestId('lien-waiver-sign-now'))
    expect(await screen.findByText('Robert Douglas signs here — Job j1')).toBeTruthy()
    expect(db.updates.filter((u) => 'signer_user_id' in u)).toEqual([])
  })

  it("#87 M · a slow read from the last job never resumes on the next job's window", async () => {
    db.releases = [askedOfMaster2]
    let comeIn: () => void = () => undefined
    db.hold = { j1: new Promise<void>((resolve) => (comeIn = resolve)) }
    const view = renderWithProviders(<LienReleaseModal signerNameFallback="Malachi Reyes" open onClose={() => undefined} job={a.job} invoice={a.inv} />)
    await opened('master-1')
    // closed before job 1's releases came back, then opened on job 2
    view.rerender(<LienReleaseModal signerNameFallback="Malachi Reyes" open={false} onClose={() => undefined} job={null} invoice={null} />)
    await settle()
    view.rerender(<LienReleaseModal signerNameFallback="Malachi Reyes" open onClose={() => undefined} job={b.job} invoice={b.inv} />)
    await opened('master-1')
    comeIn()
    await settle()
    expect(whoSigns().value).toBe('master-1')
    expect(whoSigns().disabled).toBe(false)
    expect(screen.queryByText('✍ Waiting for Robert Douglas to sign')).toBeNull()
    // the late rows never reach job 2's list either
    expect(screen.queryByText('Already on this job')).toBeNull()
  })

  it('#87 M · taken back with Cancel request, an archived leader stops being the pick', async () => {
    db.master2Archived = true
    db.releases = [askedOfMaster2]
    renderWithProviders(<LienReleaseModal signerNameFallback="Malachi Reyes" open onClose={() => undefined} job={a.job} invoice={a.inv} />)
    await opened('master-2')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }))
    await waitFor(() => expect(whoSigns().disabled).toBe(false))
    expect([...whoSigns().options].map((o) => o.textContent)).toEqual(['Malachi Reyes', 'Dana Whites'])
    expect(whoSigns().value).toBe('master-1')
    // what the select shows is what gets asked: the next request goes to the job's default, not the archived leader
    db.updates = []
    fireEvent.click(screen.getByRole('button', { name: 'Send it to his desk' }))
    await waitFor(() => expect(db.updates.some((u) => 'signer_user_id' in u)).toBe(true))
    expect(db.updates.find((u) => 'signer_user_id' in u)?.signer_user_id).toBe('master-1')
  })

  it('#87 N · a draft reopens on the leader it saved, the pick autosaves, one off the list gives way, and a fresh waiver invents no signer', async () => {
    // a draft a request went back to keeps the leader it asked: the page prints Robert, and so does the pick
    const draftOfMaster2 = { ...askedOfMaster2, status: 'draft', minted_at: null, signature_requested_at: null }
    db.releases = [draftOfMaster2]
    let view = renderWithProviders(<LienReleaseModal signerNameFallback="Malachi Reyes" open onClose={() => undefined} job={a.job} invoice={a.inv} />)
    await opened('master-2')
    expect(whoSigns().disabled).toBe(false)
    // picking another leader is an edit the draft saves, so the next opening finds him
    fireEvent.change(whoSigns(), { target: { value: 'master-3' } })
    await waitFor(() => expect(db.updates.some((u) => u.signer_user_id === 'master-3' && !('status' in u))).toBe(true), { timeout: 4000 })
    view.unmount()

    // the leader a draft saved has since been archived: the pick falls back to the job's default
    db.updates = []
    db.master2Archived = true
    db.releases = [draftOfMaster2]
    view = renderWithProviders(<LienReleaseModal signerNameFallback="Malachi Reyes" open onClose={() => undefined} job={a.job} invoice={a.inv} />)
    await opened('master-1')
    view.unmount()
    db.master2Archived = false

    // a fresh waiver on a job whose own leader is off the list: the pad is never put in another person's name
    db.releases = []
    renderWithProviders(<LienReleaseModal signerNameFallback="Taunya" open onClose={() => undefined} job={offList.job} invoice={offList.inv} />)
    await screen.findByTestId('lien-waiver-signer')
    await settle()
    expect([...whoSigns().options].map((o) => o.textContent)).toEqual(['Dana Whites', 'Malachi Reyes', 'Robert Douglas'])
    fireEvent.click(screen.getByTestId('lien-waiver-sign-now'))
    expect(await screen.findByText('Sign release of lien — Job j9')).toBeTruthy()
    expect(screen.queryByText(/Taunya signs here/)).toBeNull()
  })

  it('#87 M · a request asked of someone the window cannot name never puts the pad in the name the page prints', async () => {
    db.releases = [{ ...askedOfMaster2, id: 'rel-9', job_id: 'j9', invoice_ids: ['inv-j9'], signer_user_id: 'master-9', fields: { ...askedOfMaster2.fields, signerName: 'Taunya' } }]
    renderWithProviders(<LienReleaseModal signerNameFallback="Taunya" open onClose={() => undefined} job={offList.job} invoice={offList.inv} />)
    await screen.findByText('✍ Waiting for Taunya to sign')
    await settle()
    expect([...whoSigns().options].map((o) => o.textContent)).toEqual(['Dana Whites', 'Malachi Reyes', 'Robert Douglas'])
    fireEvent.click(screen.getByTestId('lien-waiver-sign-now'))
    expect(await screen.findByText('Sign release of lien — Job j9')).toBeTruthy()
    expect(screen.queryByText(/Taunya signs here/)).toBeNull()
  })

  it('#87 M · closed and reopened in the same session, the request keeps its leader', async () => {
    db.releases = [askedOfMaster2]
    const view = renderWithProviders(<LienReleaseModal signerNameFallback="Malachi Reyes" open onClose={() => undefined} job={a.job} invoice={a.inv} />)
    await opened('master-2')
    view.rerender(<LienReleaseModal signerNameFallback="Malachi Reyes" open={false} onClose={() => undefined} job={null} invoice={null} />)
    await settle()
    view.rerender(<LienReleaseModal signerNameFallback="Malachi Reyes" open onClose={() => undefined} job={a.job} invoice={a.inv} />)
    await opened('master-2')
    expect(whoSigns().disabled).toBe(true)
  })
})
