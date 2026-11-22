import { describe, expect, it } from 'vitest'
import {
  activityBadge,
  importConfidenceBadge,
  importJobBadge,
  notificationBadge,
  tourBadge,
} from './statusBadge'

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

describe('importConfidenceBadge', () => {
  it.each([
    [0.95, 'sent'],
    [0.9, 'sent'],
    [0.89, 'pending'],
    [0.7, 'pending'],
    [0.69, 'failed'],
  ] as const)('%s → %s', (c, badge) => {
    expect(importConfidenceBadge(c)).toBe(badge)
  })
})

describe('importJobBadge', () => {
  it.each([
    ['uploaded', 'scheduled'],
    ['detecting', 'scheduled'],
    ['extracting', 'scheduled'],
    ['normalizing', 'scheduled'],
    ['confirming', 'scheduled'],
    ['ready', 'pending'],
    ['done', 'sent'],
    ['failed', 'failed'],
    ['discarded', 'off'],
    ['constructor', 'off'],
  ])('%s → %s', (status, badge) => {
    expect(importJobBadge(status)).toBe(badge)
  })
})
