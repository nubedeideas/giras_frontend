import { describe, expect, it } from 'vitest'
import { isTourTeamGroup } from './useNotificationGroups'

describe('isTourTeamGroup', () => {
  it('solo el system_key tour_team es el Equipo de la gira', () => {
    expect(isTourTeamGroup({ system_key: 'tour_team' })).toBe(true)
    expect(isTourTeamGroup({ system_key: 'band' })).toBe(false)
    expect(isTourTeamGroup({ system_key: null })).toBe(false)
    expect(isTourTeamGroup({})).toBe(false)
  })
})
