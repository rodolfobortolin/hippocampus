import { test } from 'node:test'
import assert from 'node:assert/strict'
import { config, dayOf } from '../core/config.ts'

test('a madrugada conta para o dia anterior', () => {
  config.dayStartHour = 4
  // 2h da manhã de segunda ainda é o domingo de quem estava trabalhando.
  const madrugada = new Date(2026, 8, 21, 2, 30).getTime() / 1000
  assert.equal(dayOf(madrugada), '2026-09-20')

  const manha = new Date(2026, 8, 21, 9, 0).getTime() / 1000
  assert.equal(dayOf(manha), '2026-09-21')

  // Exatamente na virada já é o dia novo.
  const virada = new Date(2026, 8, 21, 4, 0).getTime() / 1000
  assert.equal(dayOf(virada), '2026-09-21')
})

test('mudar a hora da virada muda a que dia um instante pertence', () => {
  const instante = new Date(2026, 8, 21, 5, 0).getTime() / 1000
  config.dayStartHour = 4
  assert.equal(dayOf(instante), '2026-09-21')
  config.dayStartHour = 6
  assert.equal(dayOf(instante), '2026-09-20')
  config.dayStartHour = 4
})
