import { describe, expect, it } from 'vitest'
import { azPhoneCustomers, matchPhoneCustomers, owingPhoneCustomers, phoneActivityWords, phoneCustomerLines, phoneCustomerSubline, phoneJobSearchFilter, recentPhoneCustomers, type PhoneCustomer } from './customerPhoneSearch'

const c = (over: Partial<PhoneCustomer>): PhoneCustomer => ({ id: over.name ?? 'x', name: 'X', address: '', phone: '', email: '', archived: false, masterName: '', masterEmail: '', lastActivityIso: '', openBalance: 0, openJobs: 0, jobs: 0, ...over })

const rows = [
  c({ name: 'Alder Homes', address: '12 Lenox Ct', phone: '(210) 555-0142', lastActivityIso: '2026-09-20', openBalance: 1240, openJobs: 1, jobs: 4 }),
  c({ name: 'Lenox Builders', email: 'office@lenox.example', lastActivityIso: '2026-09-26T14:00:00Z', jobs: 6 }),
  c({ name: 'Old Lenox Co', archived: true, lastActivityIso: '2024-02-01' }),
  c({ name: 'The Lenox Group', masterName: 'Bryan', openBalance: 9000 }),
  c({ name: 'Zed Plumbing Supply', address: '9 Main St', lastActivityIso: '2025-03-04' }),
]

describe('matchPhoneCustomers', () => {
  it('finds by name, address, phone, email and the account person; best name match first, archived last', () => {
    expect(matchPhoneCustomers(rows, 'lenox').map((r) => r.name)).toEqual(['Lenox Builders', 'The Lenox Group', 'Alder Homes', 'Old Lenox Co'])
    expect(matchPhoneCustomers(rows, 'BRYAN').map((r) => r.name)).toEqual(['The Lenox Group'])
    expect(matchPhoneCustomers(rows, 'office@').map((r) => r.name)).toEqual(['Lenox Builders'])
  })
  it('finds a phone typed with or without its punctuation, and nothing for an empty query', () => {
    expect(matchPhoneCustomers(rows, '5550142').map((r) => r.name)).toEqual(['Alder Homes'])
    expect(matchPhoneCustomers(rows, '555-0142').map((r) => r.name)).toEqual(['Alder Homes'])
    expect(matchPhoneCustomers(rows, '12').map((r) => r.name)).toEqual(['Alder Homes']) // the address, not two digits of a phone
    expect(matchPhoneCustomers(rows, '   ')).toEqual([])
  })
})

describe('the lists before anything is typed', () => {
  it('Recent is recently active, newest first, never archived, capped', () => {
    expect(recentPhoneCustomers(rows).map((r) => r.name)).toEqual(['Lenox Builders', 'Alder Homes', 'Zed Plumbing Supply'])
    expect(recentPhoneCustomers(rows, 1).map((r) => r.name)).toEqual(['Lenox Builders'])
  })
  it('Owes is the most owed first', () => {
    expect(owingPhoneCustomers(rows).map((r) => r.name)).toEqual(['The Lenox Group', 'Alder Homes'])
  })
  it('Everyone A–Z pages and says when there is more', () => {
    expect(azPhoneCustomers(rows, 2)).toMatchObject({ total: 4, more: true })
    expect(azPhoneCustomers(rows, 2).rows.map((r) => r.name)).toEqual(['Alder Homes', 'Lenox Builders'])
    expect(azPhoneCustomers(rows, 50).more).toBe(false)
  })
})

describe('the row’s words', () => {
  const opts = { todayYmd: '2026-09-27', moneyHidden: false, formatMoney: (n: number) => `$${n.toLocaleString('en-US')}` }
  it('says how long since the customer was active', () => {
    expect(phoneActivityWords('2026-09-27T09:00:00Z', '2026-09-27')).toBe('today')
    expect(phoneActivityWords('2026-09-26', '2026-09-27')).toBe('yesterday')
    expect(phoneActivityWords('2026-09-20', '2026-09-27')).toBe('7 d ago')
    expect(phoneActivityWords('2025-03-04', '2026-09-27')).toBe('Mar 2025')
    expect(phoneActivityWords('', '2026-09-27')).toBe('')
  })
  it('prints the address, the jobs, what is owed and the activity; money only for a role that may see it', () => {
    expect(phoneCustomerSubline(rows[0]!, opts)).toBe('12 Lenox Ct · 1 open job · owes $1,240 · active 7 d ago')
    expect(phoneCustomerSubline(rows[0]!, { ...opts, moneyHidden: true })).toBe('12 Lenox Ct · 1 open job · active 7 d ago')
    expect(phoneCustomerSubline(rows[2]!, opts)).toBe('Archived · active Feb 2024')
    expect(phoneCustomerSubline(rows[1]!, opts)).toBe('6 jobs · active yesterday')
  })
})

describe('phoneJobSearchFilter', () => {
  it('builds the or-filter over the job’s name, address and numbers', () => {
    expect(phoneJobSearchFilter('lenox')).toBe('job_name.ilike.%lenox%,job_address.ilike.%lenox%,hcp_number.ilike.%lenox%,click_number.ilike.%lenox%')
  })
  it('drops the characters that would break the filter, and asks for two characters', () => {
    expect(phoneJobSearchFilter('a')).toBeNull()
    expect(phoneJobSearchFilter('  ')).toBeNull()
    expect(phoneJobSearchFilter('oak, (creek)%')).toBe('job_name.ilike.%oak creek%,job_address.ilike.%oak creek%,hcp_number.ilike.%oak creek%,click_number.ilike.%oak creek%')
  })
})

describe('phoneCustomerLines (v2.3895)', () => {
  const opts = { todayYmd: '2026-09-27', moneyHidden: false, formatMoney: (n: number) => `$${n.toLocaleString('en-US')}` }
  it('keeps the place and the standing on lines of their own', () => {
    expect(phoneCustomerLines(rows[0]!, opts)).toEqual({ place: '12 Lenox Ct', standing: '1 open job · owes $1,240 · active 7 d ago' })
    expect(phoneCustomerLines(rows[2]!, opts)).toEqual({ place: '', standing: 'Archived · active Feb 2024' })
    expect(phoneCustomerLines(rows[0]!, { ...opts, moneyHidden: true }).standing).toBe('1 open job · active 7 d ago')
  })
})


describe('phoneActivityWords · an evening instant keeps its day (v2.4471)', () => {
  it('reads a job made last evening as yesterday, and a paid day as it is', () => {
    // 00:30 UTC on Sep 27 is 7:30 pm CDT on Sep 26; 00:30 UTC on Dec 2 is 6:30 pm CST on Dec 1.
    expect(phoneActivityWords('2026-09-27T00:30:00Z', '2026-09-27')).toBe('yesterday')
    expect(phoneActivityWords('2026-12-02T00:30:00+00:00', '2026-12-08')).toBe('7 d ago')
    expect(phoneActivityWords('2026-09-27T12:00:00Z', '2026-09-27')).toBe('today')
    expect(phoneActivityWords('2026-09-26', '2026-09-27')).toBe('yesterday')
  })
})
