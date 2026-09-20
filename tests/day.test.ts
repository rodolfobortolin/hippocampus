import { test } from 'node:test'
import assert from 'node:assert/strict'
import { config, dayOf } from '../core/config.ts'

test('the small hours belong to the day before', () => {
  config.dayStartHour = 4
  // 2am on a Monday is still the Sunday of whoever was working.
  const madrugada = new Date(2026, 8, 21, 2, 30).getTime() / 1000
  assert.equal(dayOf(madrugada), '2026-09-20')

  const manha = new Date(2026, 8, 21, 9, 0).getTime() / 1000
  assert.equal(dayOf(manha), '2026-09-21')

  // Exactly at the turn it is already the new day.
  const virada = new Date(2026, 8, 21, 4, 0).getTime() / 1000
  assert.equal(dayOf(virada), '2026-09-21')
})

test('moving the turn of the day moves which day an instant belongs to', () => {
  const instante = new Date(2026, 8, 21, 5, 0).getTime() / 1000
  config.dayStartHour = 4
  assert.equal(dayOf(instante), '2026-09-21')
  config.dayStartHour = 6
  assert.equal(dayOf(instante), '2026-09-20')
  config.dayStartHour = 4
})
