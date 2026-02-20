import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type PayConfigRow = {
  person_name: string
  hourly_wage: number | null
  is_salary: boolean
  show_in_cost_matrix: boolean
}

type HoursRow = { person_name: string; work_date: string; hours: number }

function getMatrixDateRange(): { start: string; end: string } {
  const d = new Date()
  const day = d.getDay()
  const start = new Date(d)
  start.setDate(d.getDate() - day)
  const end = new Date(d)
  end.setDate(d.getDate() - day + 6)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = []
  const d = new Date(start + 'T12:00:00')
  const endD = new Date(end + 'T12:00:00')
  while (d <= endD) {
    days.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return days
}

export function useCostMatrixTotal(enabled: boolean): { total: number | null; loading: boolean } {
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setTotal(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setTotal(null)

    const { start, end } = getMatrixDateRange()
    const days = getDaysInRange(start, end)

    Promise.all([
      supabase.from('people_pay_config').select('person_name, hourly_wage, is_salary, show_in_cost_matrix'),
      supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', start).lte('work_date', end),
      supabase.from('people_hours_display_order').select('person_name, sequence_order'),
    ])
      .then(([configRes, hoursRes, orderRes]) => {
        if (cancelled) return
        const payConfig = (configRes.data ?? []) as PayConfigRow[]
        const peopleHours = (hoursRes.data ?? []) as HoursRow[]
        const orderData = (orderRes.data ?? []) as { person_name: string; sequence_order: number }[]

        const configMap: Record<string, PayConfigRow> = {}
        for (const r of payConfig) configMap[r.person_name] = r

        const orderMap: Record<string, number> = {}
        for (const r of orderData) orderMap[r.person_name] = r.sequence_order

        const showPeople = Object.keys(configMap)
          .filter((n) => configMap[n]?.show_in_cost_matrix ?? false)
          .sort((a, b) => {
            const orderA = orderMap[a] ?? 999999
            const orderB = orderMap[b] ?? 999999
            return orderA !== orderB ? orderA - orderB : a.localeCompare(b)
          })

        function getHoursForPersonDate(personName: string, workDate: string): number {
          const row = peopleHours.find((h) => h.person_name === personName && h.work_date === workDate)
          return row?.hours ?? 0
        }

        function getEffectiveHours(personName: string, workDate: string): number {
          const cfg = configMap[personName]
          if (cfg?.is_salary) {
            const day = new Date(workDate + 'T12:00:00').getDay()
            if (day === 0 || day === 6) return 0
            return 8
          }
          return getHoursForPersonDate(personName, workDate)
        }

        function getCostForPersonDate(personName: string, workDate: string): number {
          const cfg = configMap[personName]
          const wage = cfg?.hourly_wage ?? 0
          const hrs = getEffectiveHours(personName, workDate)
          return wage * hrs
        }

        // showMaxHours=false: use actual hours (same as People page default)
        const sum = days.reduce(
          (daySum, d) => daySum + showPeople.reduce((s, p) => s + getCostForPersonDate(p, d), 0),
          0
        )
        setTotal(sum)
      })
      .catch(() => {
        if (!cancelled) setTotal(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled])

  return { total, loading }
}
