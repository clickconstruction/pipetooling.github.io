import { useEffect, useState } from 'react'
import { BILL_READ_ROLES } from '../lib/materials/bills/billRead'
import { supabaseBillsIo } from '../lib/materials/bills/billsToRecordIo'

/**
 * Supply-house bill capture (punch list #179 PR 3, v2.6095): whether the fill from a PDF is on, for the surfaces that
 * show its doors (the thread's *Record this bill*, the house's *N bills to record*, the form's *The bill*). One read
 * of `app_settings.bill_read_on_v1` for the page, shared; off until it answers, and off for every role outside the
 * office, who never see the doors whatever the switch says. `refresh` re-reads after the owner's press on the switch.
 */
let shared: Promise<boolean> | null = null

export function readBillSwitch(force = false): Promise<boolean> {
  if (!shared || force) shared = supabaseBillsIo().switchOn().catch(() => false)
  return shared
}

/** For a smoke: the next read answers this. */
export function primeBillSwitch(on: boolean | null): void {
  shared = on === null ? null : Promise.resolve(on)
}

export function useBillReadSwitch(role: string | null | undefined): { on: boolean; refresh: () => Promise<boolean> } {
  const office = role != null && BILL_READ_ROLES.has(role)
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!office) return
    let live = true
    void readBillSwitch().then((v) => live && setOn(v))
    return () => {
      live = false
    }
  }, [office])
  return {
    on: office && on,
    refresh: async () => {
      const v = await readBillSwitch(true)
      setOn(v)
      return office && v
    },
  }
}
