import { test } from 'node:test'
import assert from 'node:assert/strict'
import { heatmap, periodSummary } from '../core/metrics.ts'
import { today } from '../core/config.ts'

/**
 * Clicking a cell of the heatmap narrows the charts below it to that slot.
 *
 * That only means something if the two count the same way. The map files a
 * block under the hour it started, on the local clock; if the filter read the
 * day column instead, which turns over at four in the morning, or the hour a
 * block ended, a cell reading "2h10" would open onto charts adding up to
 * something else — and nothing on screen would say so.
 *
 * So every cell is checked against the filter, not a sample of them.
 */
const to = today()
const from = new Date(Date.parse(`${to}T12:00:00`) - 89 * 86_400_000).toISOString().slice(0, 10)

test('every cell of the map is exactly what the filter adds up for it', () => {
  const grid = heatmap(from, to)
  for (let weekday = 0; weekday < 7; weekday++) {
    for (let hour = 0; hour < 24; hour++) {
      const narrowed = periodSummary(from, to, { weekday, hour }).total
      assert.equal(narrowed, grid[weekday][hour],
        `weekday ${weekday} at ${hour}h: the map says ${grid[weekday][hour]}s, the filter ${narrowed}s`)
    }
  }
})

test('a whole weekday is the sum of its row', () => {
  const grid = heatmap(from, to)
  for (let weekday = 0; weekday < 7; weekday++) {
    const row = grid[weekday].reduce((sum, seconds) => sum + seconds, 0)
    assert.equal(periodSummary(from, to, { weekday }).total, row, `weekday ${weekday}`)
  }
})

test('no slot at all is the whole period, as before', () => {
  const grid = heatmap(from, to)
  const everything = grid.flat().reduce((sum, seconds) => sum + seconds, 0)
  assert.equal(periodSummary(from, to).total, everything)
  assert.equal(periodSummary(from, to, { weekday: null, hour: null }).total, everything)
})
