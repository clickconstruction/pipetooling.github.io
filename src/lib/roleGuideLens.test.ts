import { describe, expect, it } from 'vitest'
import { guideLensRoleLabel, guideLensRolesFor } from './roleGuideLens'

describe('guideLensRolesFor', () => {
  it('gives dev every role below, highest first', () => {
    expect(guideLensRolesFor('dev')).toEqual([
      'master_technician',
      'controller',
      'assistant',
      'superintendent',
      'estimator',
      'primary',
      'subcontractor',
      'helpers',
    ])
  })

  it('a master sees controller and below; a superintendent sees only field/client roles', () => {
    expect(guideLensRolesFor('master_technician')).toEqual([
      'controller',
      'assistant',
      'superintendent',
      'estimator',
      'primary',
      'subcontractor',
      'helpers',
    ])
    expect(guideLensRolesFor('superintendent')).toEqual(['estimator', 'primary', 'subcontractor', 'helpers'])
  })

  it('non-supervising roles and null get no lens', () => {
    expect(guideLensRolesFor('estimator')).toEqual([])
    expect(guideLensRolesFor('primary')).toEqual([])
    expect(guideLensRolesFor('subcontractor')).toEqual([])
    expect(guideLensRolesFor('helpers')).toEqual([])
    expect(guideLensRolesFor(null)).toEqual([])
  })
})

describe('guideLensRoleLabel', () => {
  it('uses the spoken role names, not the DB slugs', () => {
    expect(guideLensRoleLabel('master_technician')).toBe('Master')
    expect(guideLensRoleLabel('subcontractor')).toBe('Sub')
    expect(guideLensRoleLabel('helpers')).toBe('Helper')
    expect(guideLensRoleLabel('superintendent')).toBe('Superintendent')
  })
})
