// Tasks on the Daily screen: Today's tasks, and the mind dump under them.
//
// Kept as plain as a list on paper: one line per task, tap the box when it is
// done. Nothing to fill in: no times, no subtasks, no priority. A `#word`
// anywhere in the line is a tag, if you want one.
//
// Rules live in lib/tasks.ts.
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { bareText, daysBetween, inDump, isOnToday, isStale, tagsOf, type Task } from '../lib/tasks'

export interface TaskActions {
  /** one task per line; `today` puts them straight on Today */
  onAdd: (text: string, today: boolean) => void
  onToggleDone: (id: string) => void
  /** true → on Today, false → back to the dump */
  onPlan: (id: string, today: boolean) => void
  onRename: (id: string, text: string) => void
  onDelete: (id: string) => void
}

/** A done task stays in view this long, so a mis-tap can be undone (as habits do). */
const DONE_HIDE_MS = 10_000

function Tags({ text }: { text: string }) {
  const tags = tagsOf(text)
  if (tags.length === 0) return null
  return (
    <>
      {tags.map((t) => (
        <span key={t} className="task-tag">
          #{t}
        </span>
      ))}
    </>
  )
}

/** Inline rename: Enter or leaving the field saves, Escape cancels. */
function EditText({ task, onSave, onCancel }: { task: Task; onSave: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(task.text)
  return (
    <input
      autoFocus
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => (text.trim() && text.trim() !== task.text ? onSave(text) : onCancel())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') onCancel()
      }}
      aria-label="Task text"
      className="min-w-0 flex-1 border-2 border-black bg-neo-bg px-2 py-1 text-sm font-bold"
    />
  )
}

/** The row's ⋯ menu: the few things a task can have done to it besides being ticked. */
function RowMenu({
  task,
  onToday,
  actions,
  onEdit,
  onClose,
}: {
  task: Task
  onToday: boolean
  actions: TaskActions
  onEdit: () => void
  onClose: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  const btn = 'neo-button bg-white px-2.5 py-1 text-[11px] font-bold uppercase'
  return (
    <div className="flex flex-wrap gap-2 border-x-2 border-b-2 border-black bg-white p-2">
      {task.doneAt === null && (
        <button
          type="button"
          className={btn}
          onClick={() => {
            actions.onPlan(task.id, !onToday)
            onClose()
          }}
        >
          {onToday ? '↓ Later (to dump)' : '↑ Today'}
        </button>
      )}
      <button type="button" className={btn} onClick={onEdit}>
        ✎ Edit
      </button>
      {confirm ? (
        <button type="button" className="neo-button neo-card-red px-2.5 py-1 text-[11px] font-bold uppercase" onClick={() => actions.onDelete(task.id)}>
          Delete for good
        </button>
      ) : (
        <button type="button" className={`${btn} text-neo-red`} onClick={() => setConfirm(true)}>
          🗑 Delete
        </button>
      )}
    </div>
  )
}

function TodayRow({ task, today, open, onOpen, actions }: { task: Task; today: string; open: boolean; onOpen: (id: string | null) => void; actions: TaskActions }) {
  const [editing, setEditing] = useState(false)
  const done = task.doneAt !== null
  const age = task.today && !done ? daysBetween(task.today, today) : 0
  return (
    <motion.li
      layout="position"
      exit={{ opacity: 0, height: 0, transition: { duration: 0.25 } }}
      className="list-none"
    >
      <div className={`neo-button flex w-full items-center gap-2 py-1 pl-2 pr-2 ${done ? 'neo-card-green' : 'bg-neo-white'}`}>
        <button
          type="button"
          onClick={() => actions.onToggleDone(task.id)}
          aria-pressed={done}
          aria-label={done ? `Mark ${task.text} not done` : `Mark ${task.text} done`}
          className={`task-box ${done ? 'is-done' : ''}`}
        >
          {done ? '✓' : ''}
        </button>
        {editing ? (
          <EditText
            task={task}
            onSave={(t) => {
              actions.onRename(task.id, t)
              setEditing(false)
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => actions.onToggleDone(task.id)}
            className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 py-2 text-left"
          >
            <span className={`text-base font-bold ${done ? 'line-through opacity-70' : ''}`}>{bareText(task.text)}</span>
            <Tags text={task.text} />
          </button>
        )}
        {age > 0 && (
          <span className="task-age num" title={`On Today for ${age + 1} days`}>
            {age}d
          </span>
        )}
        <button
          type="button"
          onClick={() => onOpen(open ? null : task.id)}
          aria-label={`More for ${task.text}`}
          aria-expanded={open}
          className="shrink-0 px-1 py-2 text-sm font-bold text-black/40"
        >
          {open ? '✕' : '⋯'}
        </button>
      </div>
      {open && (
        <RowMenu
          task={task}
          onToday
          actions={actions}
          onEdit={() => {
            setEditing(true)
            onOpen(null)
          }}
          onClose={() => onOpen(null)}
        />
      )}
    </motion.li>
  )
}

function DumpRow({ task, open, onOpen, actions }: { task: Task; open: boolean; onOpen: (id: string | null) => void; actions: TaskActions }) {
  const [editing, setEditing] = useState(false)
  const stale = isStale(task)
  return (
    <li className="list-none">
      <div className="flex w-full items-center gap-2 border-2 border-black bg-white py-1 pl-2 pr-2">
        {editing ? (
          <EditText
            task={task}
            onSave={(t) => {
              actions.onRename(task.id, t)
              setEditing(false)
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5">
            <span className="text-sm font-bold">{bareText(task.text)}</span>
            <Tags text={task.text} />
            {stale && <span className="task-age" title="Sitting in the dump a while: the monthly review will ask about it">old</span>}
          </span>
        )}
        <button
          type="button"
          onClick={() => actions.onPlan(task.id, true)}
          title="Put it on Today"
          className="neo-button shrink-0 bg-neo-yellow px-2 py-1 text-[11px] font-bold uppercase"
        >
          ↑ Today
        </button>
        <button
          type="button"
          onClick={() => onOpen(open ? null : task.id)}
          aria-label={`More for ${task.text}`}
          aria-expanded={open}
          className="shrink-0 px-1 py-1.5 text-sm font-bold text-black/40"
        >
          {open ? '✕' : '⋯'}
        </button>
      </div>
      {open && (
        <RowMenu
          task={task}
          onToday={false}
          actions={actions}
          onEdit={() => {
            setEditing(true)
            onOpen(null)
          }}
          onClose={() => onOpen(null)}
        />
      )}
    </li>
  )
}

/** One box for everything: Enter drops it in the dump, "Today" puts it on today's list. Pasting several lines adds several tasks. */
function QuickAdd({ onAdd }: { onAdd: TaskActions['onAdd'] }) {
  const [text, setText] = useState('')
  const submit = (today: boolean) => {
    if (!text.trim()) return
    onAdd(text, today)
    setText('')
  }
  return (
    <div className="task-add">
      <textarea
        value={text}
        rows={Math.min(6, Math.max(1, text.split('\n').length))}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit(false)
          }
        }}
        placeholder="Dump anything… (#tag optional, one per line)"
        aria-label="New task"
        className="min-w-0 flex-1 resize-none border-2 border-black bg-white px-3 py-2 text-sm font-bold"
      />
      <div className="flex shrink-0 flex-col gap-1.5">
        <button type="button" onClick={() => submit(true)} className="neo-button neo-card-yellow px-3 py-1.5 text-[11px] font-bold uppercase">
          ＋ Today
        </button>
        <button type="button" onClick={() => submit(false)} className="neo-button bg-white px-3 py-1.5 text-[11px] font-bold uppercase">
          ＋ Dump
        </button>
      </div>
    </div>
  )
}

export function TaskPanel({ tasks, today, actions }: { tasks: Task[]; today: string; actions: TaskActions }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [dumpOpen, setDumpOpen] = useState(false)
  const [tag, setTag] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const onToday = useMemo(() => tasks.filter((t) => isOnToday(t, today)), [tasks, today])
  const dump = useMemo(() => tasks.filter(inDump).reverse(), [tasks]) // newest thought first
  const doneToday = onToday.filter((t) => t.doneAt !== null)
  const hidden = (t: Task): boolean => t.doneAt !== null && now - Date.parse(t.doneAt) >= DONE_HIDE_MS
  // open ones first, in the order they were written down; done ones sink
  const shown = (showDone ? onToday : onToday.filter((t) => !hidden(t))).slice().sort((a, b) => Number(a.doneAt !== null) - Number(b.doneAt !== null))
  const hiddenCount = onToday.filter(hidden).length

  // wake when the next done task is due to step aside
  useEffect(() => {
    const due = onToday
      .filter((t) => t.doneAt !== null)
      .map((t) => Date.parse(t.doneAt!) + DONE_HIDE_MS)
      .filter((t) => t > Date.now())
    if (due.length === 0) return
    const id = window.setTimeout(() => setNow(Date.now()), Math.min(...due) - Date.now() + 20)
    return () => window.clearTimeout(id)
  }, [onToday, now])

  const dumpTags = useMemo(() => [...new Set(dump.flatMap((t) => tagsOf(t.text)))].sort(), [dump])
  const dumpShown = tag ? dump.filter((t) => tagsOf(t.text).includes(tag)) : dump

  return (
    <section className="task-panel" aria-label="Tasks">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="today-title">Tasks</h2>
          {onToday.length > 0 && (
            <span className="num text-sm font-bold">
              {doneToday.length}/{onToday.length}
            </span>
          )}
        </div>
        <span className="text-[10px] font-bold uppercase text-neo-gray-dark">not counted in habits</span>
      </div>

      <QuickAdd
        onAdd={(text, toToday) => {
          actions.onAdd(text, toToday)
          if (!toToday) setDumpOpen(true)
        }}
      />

      {onToday.length === 0 ? (
        <p className="text-[11px] font-bold text-neo-gray-dark">
          No tasks on today. Add one above, or pull one up from the dump.
        </p>
      ) : shown.length === 0 ? (
        <p className="text-[12px] font-bold">✓ Every task on today is done.</p>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {shown.map((t) => (
              <TodayRow key={t.id} task={t} today={today} open={openId === t.id} onOpen={setOpenId} actions={actions} />
            ))}
          </AnimatePresence>
        </ul>
      )}
      {hiddenCount > 0 && !showDone && (
        <button type="button" onClick={() => setShowDone(true)} className="w-full text-center text-[11px] font-bold uppercase text-neo-gray-dark underline">
          {hiddenCount} done today · show
        </button>
      )}
      {showDone && doneToday.length > 0 && (
        <button type="button" onClick={() => setShowDone(false)} className="w-full text-center text-[11px] font-bold uppercase text-neo-gray-dark underline">
          Hide done ones
        </button>
      )}

      <div>
        <button
          type="button"
          onClick={() => setDumpOpen((o) => !o)}
          aria-expanded={dumpOpen}
          className="flex w-full items-center justify-between border-b-2 border-black pb-1"
        >
          <span className="hud-label border-black text-sm">Dump · {dump.length}</span>
          <span className="text-xs font-bold text-neo-gray-dark">{dumpOpen ? 'Hide ▲' : 'Show ▼'}</span>
        </button>
        {dumpOpen && (
          <div className="mt-2 space-y-2">
            {dumpTags.length > 0 && (
              <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by tag">
                {[null, ...dumpTags].map((t) => (
                  <button
                    key={t ?? '*'}
                    type="button"
                    aria-pressed={tag === t}
                    onClick={() => setTag(t)}
                    className={`neo-button px-2 py-0.5 text-[10px] font-bold uppercase ${tag === t ? 'neo-card-yellow' : 'bg-white'}`}
                  >
                    {t ? `#${t}` : 'All'}
                  </button>
                ))}
              </div>
            )}
            {dump.length === 0 ? (
              <p className="text-[11px] font-bold text-neo-gray-dark">Empty. Anything you write above with Enter lands here, until you pull it up to Today.</p>
            ) : (
              <ul className="space-y-1.5">
                {dumpShown.map((t) => (
                  <DumpRow key={t.id} task={t} open={openId === t.id} onOpen={setOpenId} actions={actions} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
