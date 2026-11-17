// @vitest-environment jsdom
/**
 * A sent notice's footer on its own (v2.7591): the facts line, the doors by role, the GC's okay form and its press.
 * The footer inside the desk, with letter two, counsel and the promise, is held by `LienDesk.render.test.tsx`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { lienSentPacketFacts, type LienSentPacketInput } from '../../lib/jobs/lienSentPacket'
import { LienDeskSentFooter } from './LienDeskSentFooter'
import { useLienSentFooterForms } from './useLienSentFooterForms'

const io = vi.hoisted(() => ({ okays: [] as unknown[] }))
vi.mock('../../lib/jobs/lienDeskIo', () => ({
  noteGcAuthorizedDirectPay: (...args: unknown[]) => {
    io.okays.push(args)
    return Promise.resolve()
  },
  notePromiseOnNotice: () => Promise.resolve(),
}))
vi.mock('../../lib/jobs/paymentChaseIo', () => ({ addJobPaymentPromise: () => Promise.resolve() }))
vi.mock('./LienTrackingOwedEditor', () => ({ default: () => null }))
vi.mock('./LienMailPieceDoors', () => ({ default: () => null }))

const first = { id: 'item-1', job_id: 'job-1', fields: null, months: ['2026-09'], sent_at: '2026-10-05T15:00:00Z', sent_filing_id: null }
const factsFor = (openBalance: number, sentItem: unknown = first) =>
  lienSentPacketFacts({ data: { letterTwoByJob: {}, items: [], ownerCallByJob: {}, filingsByJob: {} }, jobId: 'job-1', sentItem, entrySentFilingId: null, courtesyByJob: {}, payRows: [], job: undefined, address: null, gc: undefined, todayYmd: '2026-11-17', phone: () => '', openBalance } as unknown as LienSentPacketInput)

function Footer(over: Partial<ComponentProps<typeof LienDeskSentFooter>>) {
  const forms = useLienSentFooterForms()
  return (
    <LienDeskSentFooter
      forms={forms}
      facts={factsFor(900)}
      signoff={null}
      signoffLine=""
      legalSignoff={null}
      data={null}
      jobId="job-1"
      job={undefined}
      gc={undefined}
      office
      busy={false}
      run={async (_label, fn) => {
        await fn()
        return true
      }}
      authName="ZZ Test Office"
      onChanged={() => {}}
      onOpenOwnerCall={() => {}}
      doors={<span data-test-doors />}
      {...over}
    />
  )
}

afterEach(() => {
  cleanup()
  io.okays.length = 0
})

describe('LienDeskSentFooter', () => {
  it('says the GC has not paid while the sent bills still owe, and has paid when they do not', () => {
    render(<Footer />)
    expect(document.querySelector('[data-lien-since-sent]')?.textContent).toContain('GC paid: no')
    expect(document.querySelector('[data-lien-since-sent]')?.textContent).toContain('Owner called: not yet')
    cleanup()
    render(<Footer facts={factsFor(0)} />)
    expect(document.querySelector('[data-lien-since-sent]')?.textContent).toContain('GC paid: yes')
    expect(document.querySelector('[data-lien-gc-okay]')).toBeNull()
  })

  it('the office gets the doors, drawn before the three the desk hands in; anyone else gets none of its own', () => {
    render(<Footer />)
    expect(document.querySelector('[data-lien-owner-call-door]')).not.toBeNull()
    expect(document.querySelector('[data-lien-gc-okay]')).not.toBeNull()
    const doors = document.querySelector('[data-test-doors]') as HTMLElement
    expect(doors.previousElementSibling?.hasAttribute('data-lien-gc-okay')).toBe(true)
    cleanup()
    render(<Footer office={false} />)
    expect(document.querySelector('[data-lien-owner-call-door]')).toBeNull()
    expect(document.querySelector('[data-lien-gc-okay]')).toBeNull()
    expect(document.querySelector('[data-test-doors]')).not.toBeNull()
  })

  it('Record the owner’s call… hands over to the desk', () => {
    const onOpenOwnerCall = vi.fn()
    render(<Footer onOpenOwnerCall={onOpenOwnerCall} />)
    fireEvent.click(document.querySelector('[data-lien-owner-call-door]') as HTMLButtonElement)
    expect(onOpenOwnerCall).toHaveBeenCalledTimes(1)
  })

  it('the GC’s okay opens its form, needs words, and records them on the first packet under the press’s name', async () => {
    const labels: string[] = []
    render(
      <Footer
        run={async (label, fn) => {
          labels.push(label)
          await fn()
          return true
        }}
      />,
    )
    fireEvent.click(document.querySelector('[data-lien-gc-okay]') as HTMLButtonElement)
    const record = document.querySelector('[data-lien-gc-okay-record]') as HTMLButtonElement
    expect(record.disabled).toBe(true)
    fireEvent.change(document.querySelector('input[aria-label="The GC\'s okay — where and when"]') as HTMLInputElement, { target: { value: 'email, Nov 10' } })
    expect(record.disabled).toBe(false)
    fireEvent.click(record)
    await vi.waitFor(() => expect(io.okays).toHaveLength(1))
    expect(labels).toEqual(['Note the GC’s okay'])
    expect(io.okays[0]).toEqual([first, { name: 'ZZ Test Office', note: 'email, Nov 10' }])
    // The press landed: the form closes and the doors are back.
    await vi.waitFor(() => expect(document.querySelector('[data-lien-gc-okay-record]')).toBeNull())
  })

  it('a busy desk deadens the doors', () => {
    render(<Footer busy />)
    expect((document.querySelector('[data-lien-owner-call-door]') as HTMLButtonElement).disabled).toBe(true)
    expect((document.querySelector('[data-lien-gc-okay]') as HTMLButtonElement).disabled).toBe(true)
  })
})
