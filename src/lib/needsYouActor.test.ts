import { describe, expect, it } from 'vitest'
import { NEEDS_YOU_RANK, type NeedsYouItem } from './dashboardNeedsYou'
import { groupNeedsYouItems, NEEDS_YOU_ITEM_ACTOR, needsYouFoldSummary, needsYouHeaderWords, needsYouViewerActors, needsYouWalkItems } from './needsYouActor'

function item(key: NeedsYouItem['key'], title: string = key): NeedsYouItem {
  return { key, severity: 'amber', kicker: '', title, detail: '', figure: '1', actionLabel: 'Open' }
}

describe('needsYouActor · whose line it is (punch list #176, change 3)', () => {
  it('every line the builder can make has an actor', () => {
    for (const key of Object.keys(NEEDS_YOU_RANK) as NeedsYouItem['key'][]) expect(NEEDS_YOU_ITEM_ACTOR[key], key).toBeTruthy()
  })

  it('the owner reads his calls first and the office folded; the dev reads as the owner', () => {
    const items = [item('bulk-delete'), item('contract-missing'), item('lien-notice-approve'), item('robot-blocked'), item('label-approvals'), item('tally-self')]
    const g = groupNeedsYouItems(items, 'master_technician')
    expect(g.yours.map((i) => i.key)).toEqual(['bulk-delete', 'lien-notice-approve', 'tally-self'])
    expect(g.folds.map((f) => [f.actor, f.label, f.items.map((i) => i.key)])).toEqual([
      ['assistant', 'The office is on these', ['contract-missing']],
      ['controller', 'The controller is on these', ['label-approvals']],
      ['estimator', 'The estimators are on these', ['robot-blocked']],
    ])
    expect(groupNeedsYouItems(items, 'dev').yours.map((i) => i.key)).toEqual(['bulk-delete', 'lien-notice-approve', 'tally-self'])
    expect(needsYouViewerActors('dev').has('dev')).toBe(true)
  })

  it('the assistant works her lines and sees what waits on the owner, folded', () => {
    const items = [item('bulk-delete'), item('contract-missing'), item('lien-notice-approve'), item('job-account-missing')]
    const g = groupNeedsYouItems(items, 'assistant')
    expect(g.yours.map((i) => i.key)).toEqual(['contract-missing', 'job-account-missing'])
    expect(g.folds).toEqual([{ actor: 'owner', label: 'Waiting on the owner', items: [items[0], items[2]] }])
  })

  it('an estimator keeps the bid lines; nobody signed in reads only their own', () => {
    const items = [item('bid-followups'), item('contract-missing'), item('tally-self')]
    expect(groupNeedsYouItems(items, 'estimator').yours.map((i) => i.key)).toEqual(['bid-followups', 'tally-self'])
    expect(groupNeedsYouItems(items, null).yours.map((i) => i.key)).toEqual(['tally-self'])
  })

  it('the walk reaches everything, the viewer first; the fold summary names three and counts the rest; the header words', () => {
    const items = [item('contract-missing', 'A'), item('bulk-delete', 'B'), item('job-account-missing', 'C'), item('returned-check', 'D'), item('lost-bids', 'E')]
    const g = groupNeedsYouItems(items, 'master_technician')
    expect(needsYouWalkItems(g).map((i) => i.title)).toEqual(['B', 'A', 'C', 'D', 'E'])
    expect(needsYouFoldSummary(g.folds[0]!.items)).toBe('A · C · D · 1 more')
    expect(needsYouFoldSummary(g.folds[0]!.items.slice(0, 2))).toBe('A · C')
    expect(needsYouHeaderWords(g)).toEqual({ yours: '1 yours', others: '4 for others' })
    expect(needsYouHeaderWords(groupNeedsYouItems([item('bulk-delete')], 'dev'))).toEqual({ yours: '1 yours', others: '' })
  })
})
