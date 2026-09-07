import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Projects → Forecast loaders. Pins the two queries and their joins, the
 * "one workflow per project, first by id wins" rule, the drop of jobs whose
 * project has no workflow yet, the stage read's ordering and de-duplication,
 * and the grouping helper.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string, steps: Step[]) => unknown = () => []
vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') {
              return (resolve: (v: { data: unknown; error: null }) => void, reject: (e: unknown) => void) => {
                try {
                  resolve({ data: route(table, steps), error: null })
                } catch (e) {
                  reject(e)
                }
              }
            }
            return (...a: unknown[]) => {
              steps.push({ method: String(prop), args: a })
              return p
            }
          },
        },
      )
      return p
    },
  },
}))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: null }>) => (await op()).data,
}))

import { fetchForecastJobs, fetchForecastStages, groupStagesByWorkflow, type ForecastStage } from './projectsForecastData'

const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const q = (table: string) => queries.find((x) => x.table === table)!
const job = (over: Record<string, unknown>) => ({
  id: 'j', hcp_number: '100', click_number: '', job_name: 'Job', job_address: null, status: 'working', service_type_id: null, project_id: 'p1', projects: { id: 'p1', name: 'Oak Ridge' }, ...over,
})

beforeEach(() => {
  queries.length = 0
  route = () => []
})

describe('fetchForecastJobs', () => {
  it('reads project-linked jobs (newest HCP first) with the project name, then one workflow per project', async () => {
    route = (table) =>
      table === 'jobs_ledger'
        ? [job({ id: 'j1', hcp_number: '200' }), job({ id: 'j2', hcp_number: '150', project_id: 'p2', projects: { id: 'p2', name: null } }), job({ id: 'j3', hcp_number: '100', project_id: 'p3', projects: null })]
        : [
            { id: 'wf-p1-a', project_id: 'p1' },
            { id: 'wf-p1-b', project_id: 'p1' }, // duplicate: first by id wins
            { id: 'wf-p2', project_id: 'p2' },
            // p3 has no workflow yet
          ]
    const r = await fetchForecastJobs()
    expect(String(argsOf(q('jobs_ledger').steps, 'select')[0]![0])).toContain('projects:project_id(id, name)')
    expect(argsOf(q('jobs_ledger').steps, 'not')).toEqual([['project_id', 'is', null]])
    expect(argsOf(q('jobs_ledger').steps, 'order')).toEqual([['hcp_number', { ascending: false }]])
    expect(argsOf(q('jobs_ledger').steps, 'eq')).toEqual([])
    expect(argsOf(q('project_workflows').steps, 'in')).toEqual([['project_id', ['p1', 'p2', 'p3']]])
    expect(argsOf(q('project_workflows').steps, 'order')).toEqual([['id', { ascending: true }]])
    expect([...r.workflowByProject]).toEqual([
      ['p1', 'wf-p1-a'],
      ['p2', 'wf-p2'],
    ])
    expect(r.jobs).toEqual([
      { id: 'j1', hcp_number: '200', click_number: '', job_name: 'Job', job_address: null, status: 'working', service_type_id: null, project_id: 'p1', project_name: 'Oak Ridge' },
      { id: 'j2', hcp_number: '150', click_number: '', job_name: 'Job', job_address: null, status: 'working', service_type_id: null, project_id: 'p2', project_name: null },
      // j3's project has no workflow: nothing to chart, dropped
    ])
  })
  it('restricts to one customer when asked, and asks for no workflows when there are no jobs', async () => {
    await fetchForecastJobs({ customerId: 'c1' })
    expect(argsOf(q('jobs_ledger').steps, 'eq')).toEqual([['customer_id', 'c1']])
    expect(queries.map((x) => x.table)).toEqual(['jobs_ledger'])
    expect(await fetchForecastJobs({ customerId: null })).toEqual({ jobs: [], workflowByProject: new Map() })
  })
  it('a failed read throws to the caller', async () => {
    route = () => {
      throw new Error('rls')
    }
    await expect(fetchForecastJobs()).rejects.toThrow('rls')
  })
})

describe('fetchForecastStages', () => {
  it('asks nothing for no ids, otherwise reads the de-duplicated workflows’ steps in (workflow, sequence) order', async () => {
    expect(await fetchForecastStages([])).toEqual([])
    expect(queries).toHaveLength(0)
    route = () => [{ id: 's1', workflow_id: 'wf1', sequence_order: 1 }]
    const r = await fetchForecastStages(['wf1', 'wf2', 'wf1'])
    expect(argsOf(q('project_workflow_steps').steps, 'in')).toEqual([['workflow_id', ['wf1', 'wf2']]])
    expect(argsOf(q('project_workflow_steps').steps, 'order')).toEqual([
      ['workflow_id', { ascending: true }],
      ['sequence_order', { ascending: true }],
    ])
    expect(String(argsOf(q('project_workflow_steps').steps, 'select')[0]![0])).toContain('percent_complete')
    expect(r).toEqual([{ id: 's1', workflow_id: 'wf1', sequence_order: 1 }])
    route = () => null
    expect(await fetchForecastStages(['wf1'])).toEqual([])
  })
})

describe('groupStagesByWorkflow', () => {
  it('groups by workflow in first-seen order, keeping each workflow’s stage order', () => {
    const s = (id: string, wf: string, seq: number) => ({ id, workflow_id: wf, sequence_order: seq }) as ForecastStage
    const grouped = groupStagesByWorkflow([s('a1', 'wfA', 1), s('a2', 'wfA', 2), s('b1', 'wfB', 1)])
    expect([...grouped.keys()]).toEqual(['wfA', 'wfB'])
    expect(grouped.get('wfA')!.map((x) => x.id)).toEqual(['a1', 'a2'])
    expect(grouped.get('wfB')!.map((x) => x.id)).toEqual(['b1'])
    expect(groupStagesByWorkflow([]).size).toBe(0)
  })
})
