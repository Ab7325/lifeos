import { motion } from 'framer-motion'

// Two tabs, by design. The Library tab merged back into Daily (2026-09-07):
// shaping the day and running it were one job split across two screens, so the
// checklist, the shelf of switched-off habits, and the add/edit/reorder
// controls all live on Daily now. Monthly is read-only history.
export type Tab = 'daily' | 'monthly'

const TABS: { id: Tab; emoji: string; label: string }[] = [
  { id: 'daily', emoji: '⚡', label: 'Daily' },
  { id: 'monthly', emoji: '📅', label: 'Monthly' },
]

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="dock" aria-label="Tabs">
      {TABS.map((t) => (
        <button key={t.id} type="button" onClick={() => onChange(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
          {tab === t.id && <motion.span layoutId="dock-key" className="dock-key" transition={{ type: 'spring', stiffness: 500, damping: 34 }} />}
          <span className="dock-ic" aria-hidden>{t.emoji}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
