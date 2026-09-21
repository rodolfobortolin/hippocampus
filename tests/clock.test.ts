import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hoursAndMinutes } from '../core/clock.ts'
import { duration } from '../src/lib/format.ts'

/**
 * Minutes are rounded before the hours are split off.
 *
 * The other order printed "3h60" for 3h59m45s — on the Rhythm screen, in the
 * answers the model read back from its tools, and in the journal it wrote.
 * The cases are the boundaries, because that is the only place it breaks.
 */

test('the core never writes sixty minutes', () => {
  assert.equal(hoursAndMinutes(3 * 3600 + 59 * 60 + 45), '4h00')
  assert.equal(hoursAndMinutes(3 * 3600 + 59 * 60 + 29), '3h59')
  assert.equal(hoursAndMinutes(59 * 60 + 45), '1h00')
  assert.equal(hoursAndMinutes(0), '0h00')
  assert.equal(hoursAndMinutes(-5), '0h00')
})

test('the screen never writes sixty of anything', () => {
  assert.equal(duration(3 * 3600 + 59 * 60 + 45), '4h')
  assert.equal(duration(3 * 3600 + 7 * 60), '3h07')
  assert.equal(duration(59.6), '1min', '59.6 seconds is a minute, not "60s"')
  assert.equal(duration(59.4), '59s')
  assert.equal(duration(59 * 60 + 40), '1h', '59min40s is an hour, not "60min"')
  assert.equal(duration(45 * 60), '45min')
  assert.equal(duration(0), '0min')
})

test('nothing anywhere in between reads sixty', () => {
  for (let seconds = 0; seconds < 30 * 3600; seconds += 7) {
    assert.doesNotMatch(duration(seconds), /(^|h)60|^60(s|min)$/, `duration(${seconds})`)
    assert.doesNotMatch(hoursAndMinutes(seconds), /h60$/, `hoursAndMinutes(${seconds})`)
  }
})
