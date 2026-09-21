import { dayOf } from '../config.ts'
import { all, db, getMeta, setMeta } from '../db.ts'

/**
 * Meetings, from the macOS Calendar, joined with the microphone.
 *
 * The collector already knew a call was happening: the microphone open, in
 * some app. The calendar says which one — "the microphone was open for
 * 40 minutes" becomes "Sprint review, 40 minutes of it on the call". A meeting
 * with no open microphone during it is shown too; the calendar says it was
 * booked, not that anyone joined, and the two numbers side by side say that.
 *
 * The focus helper reads the calendar, never the core: the permission belongs
 * to whoever asks. Here the events are only kept.
 */

export type CalendarEvent = { id: string; title: string; start: number; end: number; calendar?: string; attendees?: number }
export type Meeting = {
  id: string; start: number; end: number; title: string; calendar: string | null; attendees: number
  /** Seconds of it with a microphone open, from the focus samples. */
  onCall: number
}

const keep = db.prepare(
  `insert into meetings (id, started_at, ended_at, day, title, calendar, attendees) values (?, ?, ?, ?, ?, ?, ?)
   on conflict(id) do update set started_at = excluded.started_at, ended_at = excluded.ended_at,
     day = excluded.day, title = excluded.title, calendar = excluded.calendar, attendees = excluded.attendees`)

/**
 * The events of one window, as the calendar has them now. A meeting that was
 * in this window before and is not any more was cancelled or moved away, and
 * goes.
 */
export function keepMeetings(from: number, to: number, events: CalendarEvent[]): number {
  const ids: string[] = []
  for (const event of events) {
    if (!(event.end > event.start)) continue
    const id = `${event.id}@${Math.round(event.start)}`
    ids.push(id)
    keep.run(id, Math.round(event.start), Math.round(event.end), dayOf(event.start),
      event.title.slice(0, 200), event.calendar ?? null, event.attendees ?? 0)
  }
  const gone = db.prepare(
    `delete from meetings where started_at >= ? and started_at < ?
       and id not in (select value from json_each(?))`).run(Math.round(from), Math.round(to), JSON.stringify(ids))
  return ids.length + Number(gone.changes)
}

/** What the helper needs to know: whether to read, and which window. */
export function calendarAsk(wanted: boolean, now = Date.now() / 1000) {
  // Yesterday to tomorrow: long enough to catch a meeting edited after it
  // happened, short enough to read in a moment.
  const midnight = new Date(now * 1000); midnight.setHours(0, 0, 0, 0)
  const start = midnight.getTime() / 1000
  return { wanted, from: start - 86_400, to: start + 2 * 86_400 }
}

export function calendarStatus(): string { return getMeta('calendar.status') }

/** Everything the calendar brought, and whether it was allowed. */
export function forgetMeetings(): void {
  db.exec('delete from meetings')
  setMeta('calendar.status', '')
}
export function setCalendarStatus(status: string): void { setMeta('calendar.status', status) }

/** A day's meetings, each with how much of it had a microphone open. */
export function meetingsOf(day: string): Meeting[] {
  const meetings = all<{ id: string; started_at: number; ended_at: number; title: string | null; calendar: string | null; attendees: number }>(
    `select id, started_at, ended_at, title, calendar, attendees from meetings where day = ? order by started_at`, day)
  if (!meetings.length) return []
  const calls = all<{ started_at: number; ended_at: number }>(
    `select started_at, ended_at from blocks where day = ? and mic = 1 order by started_at`, day)
  return meetings.map((meeting) => ({
    id: meeting.id, start: meeting.started_at, end: meeting.ended_at,
    title: meeting.title ?? '', calendar: meeting.calendar, attendees: meeting.attendees,
    onCall: calls.reduce((sum, call) =>
      sum + Math.max(0, Math.min(call.ended_at, meeting.ended_at) - Math.max(call.started_at, meeting.started_at)), 0),
  }))
}
