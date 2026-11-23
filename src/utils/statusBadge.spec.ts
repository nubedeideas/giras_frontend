import { describe, expect, it } from 'vitest'
import {
  crewLinkBadge,
  activityBadge,
  importActivityBadge,
  importConfidenceBadge,
  importJobBadge,
  importRowBadge,
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

describe('importRowBadge', () => {
  it.each([
    ['new', 'scheduled'],
    ['existing', 'sent'],
    ['adds_info', 'sent'],
    ['already_in_tour', 'sent'],
    ['name_suggestion', 'pending'],
    ['skipped', 'off'],
    ['otro', 'off'],
  ])('%s → %s', (status, badge) => {
    expect(importRowBadge(status)).toBe(badge)
  })
})

describe('importActivityBadge', () => {
  it.each([
    ['new', 'scheduled'],
    ['duplicate', 'off'],
    ['possible_duplicate', 'pending'],
    ['duplicate_in_draft', 'off'],
    ['replace', 'pending'],
    ['skipped', 'off'],
    ['duplicate_kept', 'pending'],
    ['duplicate_in_draft_kept', 'pending'],
    ['otro', 'off'],
  ])('%s → %s', (status, badge) => {
    expect(importActivityBadge(status)).toBe(badge)
  })
})

describe('crewLinkBadge', () => {
  it('listo → sent, revocado → failed, el resto → off', () => {
    expect(crewLinkBadge('active')).toBe('sent')
    expect(crewLinkBadge('revoked')).toBe('failed')
    for (const s of ['none', 'expired', 'disabled', 'unavailable', 'not_crew', 'otro']) {
      expect(crewLinkBadge(s)).toBe('off')
    }
  })
})
