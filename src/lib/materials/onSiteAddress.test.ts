import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { onSiteAddressKey, onSiteAddressStep, readOnSiteAddress, withOnSiteBox, type OnSiteAddressStep } from './onSiteAddress'

const params = (s: string) => new URLSearchParams(s)
const scan = 'tab=on-site&job=j1&container=a2'

describe('readOnSiteAddress', () => {
  it('reads the job and the box, and nothing from an empty or blank value', () => {
    expect(readOnSiteAddress(params(scan))).toEqual({ jobId: 'j1', containerId: 'a2' })
    expect(readOnSiteAddress(params('tab=on-site&job=j1'))).toEqual({ jobId: 'j1', containerId: null })
    expect(readOnSiteAddress(params('tab=on-site'))).toEqual({ jobId: null, containerId: null })
    expect(readOnSiteAddress(params('job=&container=%20'))).toEqual({ jobId: null, containerId: null })
  })
})

describe('withOnSiteBox', () => {
  it('puts the open box on the address and keeps every other parameter', () => {
    expect(withOnSiteBox(params('tab=on-site&x=1'), { jobId: 'j1', containerId: 'a2' }).toString()).toBe('tab=on-site&x=1&job=j1&container=a2')
    expect(withOnSiteBox(params(scan), { jobId: 'j2', containerId: 'b1' }).toString()).toBe('tab=on-site&job=j2&container=b1')
  })
  it('takes both off when no box is open, and leaves the address it was handed alone', () => {
    const before = params(scan)
    expect(withOnSiteBox(before, null).toString()).toBe('tab=on-site')
    expect(before.toString()).toBe(scan)
  })
})

describe('onSiteAddressStep', () => {
  const base = { jobsLoaded: true, onTab: true, selectedJobId: 'j1' as string | null, openContainerId: null as string | null }
  const at = (search: string) => readOnSiteAddress(params(search))

  it('leaves the address alone until the jobs have loaded', () => {
    expect(onSiteAddressStep({ ...base, address: at(scan), lastKey: null, jobsLoaded: false, selectedJobId: null })).toEqual({ kind: 'wait' })
  })

  it('a scan: reads the job and the box once, then keeps both on the address while the box is open', () => {
    // The first load: the jobs landed on the list's first job, the tab already opened the box the address named.
    const read = onSiteAddressStep({ ...base, address: at(scan), lastKey: null, selectedJobId: 'j9', openContainerId: 'a2' })
    expect(read).toEqual({ kind: 'read', jobId: 'j1', containerId: 'a2', key: 'j1|a2' })
    // The job chosen, the box open: the address stands. This is the step that used to take both off,
    // so the reload a new build makes right after a scan came back to the box list.
    const after = onSiteAddressStep({ ...base, address: at(scan), lastKey: 'j1|a2', openContainerId: 'a2' })
    expect(after).toEqual({ kind: 'rest', key: 'j1|a2' })
    // A reload is a new page with nothing read yet: the same address reads to the same box.
    expect(onSiteAddressStep({ ...base, address: at(scan), lastKey: null, selectedJobId: 'j9', openContainerId: 'a2' })).toEqual(read)
  })

  it('drops both when the person leaves the box', () => {
    expect(onSiteAddressStep({ ...base, address: at(scan), lastKey: 'j1|a2', openContainerId: null })).toEqual({ kind: 'write', box: null, key: '|' })
    expect(onSiteAddressStep({ ...base, address: at('tab=on-site'), lastKey: '|', openContainerId: null })).toEqual({ kind: 'rest', key: '|' })
  })

  it('a box opened by a press goes on the address, and a second box replaces the first', () => {
    expect(onSiteAddressStep({ ...base, address: at('tab=on-site'), lastKey: '|', openContainerId: 'b7' })).toEqual({ kind: 'write', box: { jobId: 'j1', containerId: 'b7' }, key: 'j1|b7' })
    expect(onSiteAddressStep({ ...base, address: at('tab=on-site&job=j1&container=b7'), lastKey: 'j1|b7', openContainerId: 'a2' })).toEqual({ kind: 'write', box: { jobId: 'j1', containerId: 'a2' }, key: 'j1|a2' })
  })

  it('a link that names only the job is read, then taken off: no box is open', () => {
    const read = onSiteAddressStep({ ...base, address: at('tab=on-site&job=j2'), lastKey: null, selectedJobId: 'j1' })
    expect(read).toEqual({ kind: 'read', jobId: 'j2', containerId: null, key: 'j2|' })
    expect(onSiteAddressStep({ ...base, address: at('tab=on-site&job=j2'), lastKey: 'j2|', selectedJobId: 'j2' })).toEqual({ kind: 'write', box: null, key: '|' })
  })

  it('an address moved by someone else wins over the open box: another scan, a door in Go anywhere, Back', () => {
    const moved = onSiteAddressStep({ ...base, address: at('tab=on-site&job=j2&container=b1'), lastKey: 'j1|a2', openContainerId: 'a2' })
    expect(moved).toEqual({ kind: 'read', jobId: 'j2', containerId: 'b1', key: 'j2|b1' })
    // Back to the first box: the address is not the one last read, so it is read again.
    expect(onSiteAddressStep({ ...base, address: at(scan), lastKey: 'j2|b1', selectedJobId: 'j2', openContainerId: 'b1' })).toEqual({ kind: 'read', jobId: 'j1', containerId: 'a2', key: 'j1|a2' })
  })

  it('an address moved to no job leaves the open box open and is written back', () => {
    expect(onSiteAddressStep({ ...base, address: at('tab=on-site'), lastKey: 'j1|a2', openContainerId: 'a2' })).toEqual({ kind: 'write', box: { jobId: 'j1', containerId: 'a2' }, key: 'j1|a2' })
  })

  it('another tab of the Tally carries no box', () => {
    expect(onSiteAddressStep({ ...base, address: at('tab=transactions&job=j1&container=a2'), lastKey: 'j1|a2', onTab: false, openContainerId: 'a2' })).toEqual({ kind: 'write', box: null, key: '|' })
  })

  it('never writes the address it already has: no step follows a rest or a write of the same words', () => {
    // Walk a write to its end: the address after the write rests.
    const write = onSiteAddressStep({ ...base, address: at('tab=on-site'), lastKey: '|', openContainerId: 'b7' }) as Extract<OnSiteAddressStep, { kind: 'write' }>
    const written = withOnSiteBox(params('tab=on-site'), write.box)
    expect(onSiteAddressKey(readOnSiteAddress(written))).toBe(write.key)
    expect(onSiteAddressStep({ ...base, address: readOnSiteAddress(written), lastKey: write.key, openContainerId: 'b7' })).toEqual({ kind: 'rest', key: 'j1|b7' })
  })
})

describe('the Tally page hands its address to the kernel', () => {
  const page = readFileSync(join(__dirname, '..', '..', 'pages', 'JobTally.tsx'), 'utf8')

  it('reads and writes the job and the box through useOnSiteAddress only', () => {
    expect(page).toContain("useOnSiteAddress({ jobIds, onTab: activeTab === 'on-site', selectedJobId, selectJob: setSelectedJobId })")
    // The page took both off the address itself before v2.6904, right after reading them.
    expect(page).not.toMatch(/delete\('(job|container)'\)/)
    expect(page).not.toMatch(/searchParams\.get\('(job|container)'\)/)
  })

  it('tells the On site tab the asked box and hears which box is open', () => {
    expect(page).toContain('initialContainerId={onSiteAddress.asked.containerId}')
    expect(page).toContain('askSeq={onSiteAddress.asked.seq}')
    expect(page).toContain('onOpenContainer={onSiteAddress.reportOpen}')
    expect(page).toContain('onPickJob={onSiteAddress.pickJob}')
  })
})
