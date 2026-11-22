import { describe, expect, it } from 'vitest'
import { activityBadge, notificationBadge, tourBadge } from './statusBadge'

describe('activityBadge', () => {
  it.each([
    ['draft', 'pending'],
    ['scheduled', 'scheduled'],
    ['confirmed', 'sent'],
    ['in_progress', 'sent'],
    ['delayed', 'pending'],
    ['completed', 'off'],
    ['cancelled', 'failed'],
  ] as const)('%s → %s', (status, badge) => {
    expect(activityBadge(status)).toBe(badge)
  })
})

describe('notificationBadge', () => {
  it.each([
    ['sent', 'sent'],
    ['scheduled', 'scheduled'],
    ['sending', 'scheduled'],
    ['draft', 'pending'],
    ['pending', 'pending'],
    ['failed', 'failed'],
    ['cancelled', 'off'],
    ['desconocido', 'off'],
    ['constructor', 'off'],
  ])('%s → %s', (status, badge) => {
    expect(notificationBadge(status)).toBe(badge)
  })
})

describe('tourBadge', () => {
  it.each([
    ['active', 'sent'],
    ['draft', 'off'],
    ['completed', 'scheduled'],
    ['cancelled', 'failed'],
  ] as const)('%s → %s', (status, badge) => {
    expect(tourBadge(status)).toBe(badge)
  })
})
