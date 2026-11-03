// Tasks — one-off things to get done, kept apart from habits on purpose.
//
// A habit comes back every day and is scored against the day; a task is done
// once and then it is gone. So tasks never touch the habit checklist's count,
// the Monthly habit graph or the sealed month records. They have their own
// review (TasksReview on the Monthly tab).
//
// Three places a task can be:
//   • the dump  — anything written down, not planned for a day (today === null)
//   • Today     — picked for today; an unfinished one simply stays on Today the
//                 next day, with its age shown, and is never a "miss"
//   • done      — doneAt / doneDay set; it leaves Today and feeds the review
//
// No forms: a task is one line of text. A `#word` in it is its tag (optional).
//
// Sync: each task is its own `task` event carrying the whole task, last-write-
// wins per task by `at`. Per task (not one list like the Sunday reset) so the
// phone and the PC editing different tasks at once never overwrite each other.
// A delete is a tombstone (deleted: true) so a stale device can't bring it back.
import { useSyncExternalStore } from 'react'

export interface Task {
  id: string
  text: string
  /** ISO — when it was written down */
  addedAt: string
  /** the day (YYYY-MM-DD) it was put on Today; null while it sits in the dump */
  today: string | null
  /** ISO — when it was ticked done; null while open */
  doneAt: string | null
  /** the habit day it was done on (the waking day, as habits use) */
  doneDay: string | null
  /** ISO — last time it was looked at in the stale review and kept */
  keptAt?: string
  deleted?: boolean
  /** ISO — LWW ordering across devices */
  at: string
}

const KEY = 'lifeos.tasks.v1'
/** A dump task untouched this long is asked about in the review. */
export const STALE_DAYS = 14

const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v))

/** Tasks arrive from other devices, so they are checked, not trusted. */
function clean(t: unknown): Task | null {
  const x = t as Partial<Task> | null
  if (!x || typeof x.id !== 'string' || !x.id || !isIso(x.at)) return null
  const text = typeof x.text === 'string' ? x.text.trim() : ''
  if (!text && !x.deleted) return null
  return {
    id: x.id,
    text,
    addedAt: isIso(x.addedAt) ? x.addedAt : x.at,
    today: isDay(x.today) ? x.today : null,
    doneAt: isIso(x.doneAt) ? x.doneAt : null,
    doneDay: isDay(x.doneDay) ? x.doneDay : null,
    ...(isIso(x.keptAt) ? { keptAt: x.keptAt } : {}),
    ...(x.deleted ? { deleted: true } : {}),
    at: x.at,
  }
}

function load(): Record<string, Task> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>
    const out: Record<string, Task> = {}
    for (const v of Object.values(raw)) {
      const t = clean(v)
      if (t) out[t.id] = t
    }
    return out
  } catch {
    return {}
  }
}

let byId: Record<string, Task> = load()
let list: Task[] = toList()
const listeners = new Set<() => void>()

/** Live tasks (tombstones left out), oldest first. */
function toList(): Task[] {
  return Object.values(byId)
    .filter((t) => !t.deleted)
    .sort((a, b) => (a.addedAt < b.addedAt ? -1 : a.addedAt > b.addedAt ? 1 : a.id < b.id ? -1 : 1))
}

function changed(): void {
  list = toList()
  try {
    localStorage.setItem(KEY, JSON.stringify(byId))
  } catch {
    /* quota — the ledger still has it */
  }
  listeners.forEach((l) => l())
}

export const getTasks = (): Task[] => list

export function useTasks(): Task[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    getTasks,
  )
}

/** Fold a task from the cloud in. Newer wins. */
export function applyTask(raw: unknown): boolean {
  const t = clean(raw)
  if (!t) return false
  const cur = byId[t.id]
  if (cur && cur.at >= t.at) return false
  byId = { ...byId, [t.id]: t }
  changed()
  return true
}

/** Save a local change; returns the stored task for the caller to send to the ledger. */
function put(t: Omit<Task, 'at'>): Task {
  const at = new Date().toISOString()
  // never older than what we hold, even with a clock that drifted back
  const prev = byId[t.id]?.at
  const task: Task = { ...t, at: prev && prev >= at ? new Date(Date.parse(prev) + 1).toISOString() : at }
  byId = { ...byId, [task.id]: task }
  changed()
  return task
}

const newId = (): string =>
  `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Split a dump into tasks: one per line, list markers stripped, so a pasted
 * note becomes a list. Returns the new tasks.
 */
export function addTasks(input: string, todayDay: string | null): Task[] {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)]|\[[ xX]?\])\s+/, '').trim())
    .filter(Boolean)
  const now = new Date().toISOString()
  return lines.map((text) =>
    put({ id: newId(), text, addedAt: now, today: todayDay, doneAt: null, doneDay: null }),
  )
}

export function patchTask(id: string, patch: Partial<Omit<Task, 'id' | 'at'>>): Task | null {
  const cur = byId[id]
  if (!cur || cur.deleted) return null
  return put({ ...cur, ...patch })
}

export const planTask = (id: string, day: string | null) => patchTask(id, { today: day })
export const finishTask = (id: string, day: string) =>
  patchTask(id, { doneAt: new Date().toISOString(), doneDay: day })
export const reopenTask = (id: string) => patchTask(id, { doneAt: null, doneDay: null })
export const renameTask = (id: string, text: string) => (text.trim() ? patchTask(id, { text: text.trim() }) : null)
export const keepTask = (id: string) => patchTask(id, { keptAt: new Date().toISOString() })
export const deleteTask = (id: string) => patchTask(id, { deleted: true })

// ── reading tasks ──

/** `#tag` words in a task's text, lower-cased. */
export function tagsOf(text: string): string[] {
  return [...text.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu)].map((m) => m[1].toLowerCase())
}

/** The text with its tags taken out, for display next to the tag chips. */
export const bareText = (text: string): string =>
  text.replace(/(?:^|\s)#[\p{L}\p{N}_-]+/gu, ' ').replace(/\s+/g, ' ').trim() || text

const dayMs = 86_400_000
/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / dayMs)

/** On Today: picked for a day up to and including today, and not done before today. */
export const isOnToday = (t: Task, today: string): boolean =>
  t.today !== null && t.today <= today && (t.doneDay === null || t.doneDay >= today)

export const inDump = (t: Task): boolean => t.today === null && t.doneAt === null

/** A dump task nobody has looked at in STALE_DAYS. */
export function isStale(t: Task, now = Date.now()): boolean {
  if (!inDump(t)) return false
  const since = Date.parse(t.keptAt ?? t.addedAt)
  return now - since >= STALE_DAYS * dayMs
}
