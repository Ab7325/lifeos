// Which day it is for the habits: the waking day (game-core/day.ts). After
// midnight Life OS stays on yesterday until the band's reading of the night
// arrives, the day is started by hand, or the day's start time comes (two hours
// before you usually wake). Every event this app writes without naming a day is
// filed under this one, so a tick at 1 a.m. still belongs to the evening it finished.
import { useEffect, useState } from 'react'
import { dayStartsAt, localDate, wakingDay } from '../game-core/day.ts'
import { getGameLink, useGameLink, type GameLink } from './gameLink'

/** Has this calendar date begun: a sleep reading filed under it, or a `day_start` for it. */
export const begun = (link: GameLink, date: string): boolean => typeof link.body[date]?.sleepScore === 'number' || link.started.includes(date)

/** When the day starts on its own (minutes after midnight), from the nights the band has read. */
export const startsAt = (link: GameLink, now: Date = new Date()): number => dayStartsAt(link.nights, localDate(now))

/** The day it is now, from what the ledger has said so far. Read by the cloud sync when an event names no day. */
export const currentDay = (now: Date = new Date()): string => {
  const link = getGameLink()
  return wakingDay(now, (d) => begun(link, d), startsAt(link, now))
}

/** The calendar date, whatever the habits' day is. */
export const calendarDay = (now: Date = new Date()): string => localDate(now)

/** The waking day, kept fresh: it changes with the clock (checked every minute) and with the ledger (a reading arriving). */
export function useToday(): { today: string; calendar: string; startsAt: number } {
  const link = useGameLink()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000)
    const wake = () => setNow(new Date())
    document.addEventListener('visibilitychange', wake)
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', wake) }
  }, [])
  const at = startsAt(link, now)
  return { today: wakingDay(now, (d) => begun(link, d), at), calendar: localDate(now), startsAt: at }
}
