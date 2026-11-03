// The Tasks part of the Monthly tab: what got done this month, day by day, and
// the dump tasks that have sat untouched long enough to be worth a decision.
//
// Read live from the task store (lib/tasks.ts), not from the sealed month
// records: tasks are not habits and never change a habit month.
import { useEffect, useMemo, useState } from 'react'
import { bareText, daysBetween, deleteTask, isOnToday, isStale, keepTask, STALE_DAYS, type Task } from '../lib/tasks'
import { dayIso, daysInMonth, shiftYm } from '../lib/monthSnapshot'

const ymOfDay = (day: string) => day.slice(0, 7)

export function TasksReview({ ym, today, tasks, onTask }: { ym: string; today: string; tasks: Task[]; onTask: (t: Task | null) => void }) {
  const [picked, setPicked] = useState<number | null>(null)
  useEffect(() => setPicked(null), [ym])

  const done = useMemo(() => tasks.filter((t) => t.doneDay && ymOfDay(t.doneDay) === ym), [tasks, ym])
  const prevDone = useMemo(() => tasks.filter((t) => t.doneDay && ymOfDay(t.doneDay) === shiftYm(ym, -1)).length, [tasks, ym])
  const byDay = useMemo(() => {
    const out: Task[][] = Array.from({ length: daysInMonth(ym) }, () => [])
    for (const t of done) out[Number(t.doneDay!.slice(8, 10)) - 1]?.push(t)
    return out
  }, [done, ym])
  const max = Math.max(1, ...byDay.map((d) => d.length))
  // how long a task took, from the day it went on Today (or was written down) to the day it was done
  const avgDays = done.length
    ? Math.round((done.reduce((n, t) => n + Math.max(0, daysBetween(t.today ?? t.addedAt.slice(0, 10), t.doneDay!)), 0) / done.length) * 10) / 10
    : null
  const running = ym === ymOfDay(today)
  const open = tasks.filter((t) => t.doneAt === null && isOnToday(t, today)).length
  const stale = running ? tasks.filter((t) => isStale(t)) : []
  const delta = done.length - prevDone
  const list = picked === null ? done : byDay[picked - 1]

  return (
    <section className="neo-card bg-white p-4" aria-label="Tasks this month">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="hud-label border-black text-xs">Tasks</div>
        <span className="text-[10px] font-bold uppercase text-neo-gray-dark">kept apart from the habit numbers</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="border-2 border-black bg-neo-yellow px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wider">Done</div>
          <div className="flex items-baseline gap-1.5">
            <span className="num font-display text-2xl font-bold">{done.length}</span>
            {prevDone > 0 || done.length > 0 ? (
              <span className={`num text-[11px] font-bold ${delta > 0 ? 'text-emerald-800' : delta < 0 ? 'text-red-700' : 'text-black/60'}`} title={`Last month: ${prevDone}`}>
                {delta > 0 ? '▲' : delta < 0 ? '▼' : '='} {Math.abs(delta)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="border-2 border-black px-3 py-2" title="From going on Today (or being written down) to done">
          <div className="text-[10px] font-bold uppercase tracking-wider text-neo-gray-dark">Avg days</div>
          <div className="num font-display text-2xl font-bold">{avgDays ?? '—'}</div>
        </div>
        <div className="border-2 border-black px-3 py-2" title="Open on Today right now">
          <div className="text-[10px] font-bold uppercase tracking-wider text-neo-gray-dark">{running ? 'Open today' : 'Open now'}</div>
          <div className="num font-display text-2xl font-bold">{open}</div>
        </div>
      </div>

      {done.length > 0 && (
        <>
          <div className="task-bars mt-4" role="group" aria-label="Tasks done per day">
            {byDay.map((d, i) => {
              const day = i + 1
              return (
                <button
                  key={day}
                  type="button"
                  disabled={d.length === 0}
                  onClick={() => setPicked(picked === day ? null : day)}
                  aria-pressed={picked === day}
                  aria-label={`${dayIso(ym, day)}: ${d.length} done`}
                  title={`${day}: ${d.length} done`}
                  className={`${d.length === 0 ? 'is-empty' : ''} ${picked === day ? 'is-picked' : ''}`}
                  style={{ height: d.length === 0 ? 2 : `${(d.length / max) * 100}%` }}
                />
              )
            })}
          </div>
          <div className="mt-1 flex justify-between text-[10px] font-bold text-neo-gray-dark">
            <span>1</span>
            <span>{daysInMonth(ym)}</span>
          </div>
          <details className="mt-3" open={picked !== null}>
            <summary className="cursor-pointer text-[11px] font-bold uppercase text-neo-gray-dark">
              {picked === null ? `All ${done.length} done this month` : `${list.length} done on the ${picked}`} ▼
            </summary>
            <ul className="mt-2 space-y-1">
              {list
                .slice()
                .sort((a, b) => (a.doneAt! < b.doneAt! ? 1 : -1))
                .map((t) => (
                  <li key={t.id} className="flex items-baseline gap-2 text-sm font-bold">
                    <span className="num w-10 shrink-0 text-[11px] text-neo-gray-dark">{Number(t.doneDay!.slice(8, 10))}</span>
                    <span className="min-w-0 flex-1">✓ {bareText(t.text)}</span>
                  </li>
                ))}
            </ul>
          </details>
        </>
      )}
      {done.length === 0 && <p className="mt-3 text-[11px] font-bold text-neo-gray-dark">No tasks done this month yet.</p>}

      {stale.length > 0 && (
        <div className="mt-4 border-t-2 border-black/10 pt-3">
          <div className="text-[11px] font-bold uppercase">Sitting in the dump {STALE_DAYS}+ days · still want them?</div>
          <ul className="mt-2 space-y-1.5">
            {stale.map((t) => (
              <li key={t.id} className="flex items-center gap-2 border-2 border-black px-2 py-1">
                <span className="min-w-0 flex-1 text-sm font-bold">{bareText(t.text)}</span>
                <span className="num shrink-0 text-[10px] font-bold text-neo-gray-dark">{daysBetween(t.addedAt.slice(0, 10), today)}d</span>
                <button type="button" onClick={() => onTask(keepTask(t.id))} className="neo-button shrink-0 bg-white px-2 py-0.5 text-[10px] font-bold uppercase">
                  Keep
                </button>
                <button type="button" onClick={() => onTask(deleteTask(t.id))} className="neo-button neo-card-red shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase">
                  Drop
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
