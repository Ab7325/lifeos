// The game, in one card: who the partner is, how far today moved it, the
// pillars, and what today is wearing down. Everything else lives on the Pokedex site.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { leaderOf, nameOf, type Game, type Moment } from '../game-core/fold.ts'
import { BALL_NAME, MOMENTUM_WINDOW, xpForLevel } from '../game-core/rules.ts'
import { POKEDEX_URL, freshMoments, itemUrl, momentKey, momentText, spriteUrl } from '../lib/game'
import { AnimatedNumber } from './AnimatedNumber'

/** A sprite from the Pokedex site; a plain block with the initial if it cannot load. */
function Sprite({ form, shiny, size, dim }: { form: string; shiny?: boolean; size: number; dim?: boolean }) {
  const [broken, setBroken] = useState<string | null>(null)
  const src = spriteUrl(form, shiny)
  if (broken === src)
    return (
      <span className="partner-blank" style={{ width: size, height: size, fontSize: size / 2.4 }} aria-hidden>
        {nameOf(form).slice(0, 1)}
      </span>
    )
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      onError={() => setBroken(src)}
      className={`partner-sprite ${dim ? 'is-asleep' : ''}`}
      style={{ width: size, height: size }}
    />
  )
}

/** One of today's pillars, as the Pokedex draws it: a ring that fills in its kind of work's colour. */
export interface PillarRing {
  id: string
  name: string
  emoji: string
  tag: string
  /** 0..1 */
  frac: number
  done: boolean
  worth: number
}

/** The mark a kind of work pays, drawn in the middle of its ring (the journal for a chore that is a pillar). */
const MARK_ICON: Record<string, string> = { code: 'machine-part', fitness: 'iron', guitar: 'poke-flute', arbor: 'grn-apricorn', sleep: 'lunar-wing', routine: 'journal' }

function ItemPic({ id, size, fallback }: { id: string; size: number; fallback?: string }) {
  const [broken, setBroken] = useState(false)
  const src = itemUrl(id)
  if (!src || broken) return fallback ? <span aria-hidden style={{ fontSize: size * 0.7, lineHeight: 1 }}>{fallback}</span> : null
  return <img src={src} alt="" width={size} height={size} className="dex-pix" onError={() => setBroken(true)} draggable={false} />
}

/** Bring a habit's row into view and make it blink, so a ring can be followed to the thing to do. */
function showRow(id: string) {
  const row = document.querySelector<HTMLElement>(`[data-habit-row="${CSS.escape(id)}"]`)
  if (!row) return
  row.scrollIntoView({ behavior: 'smooth', block: 'center' })
  row.classList.remove('row-call')
  void row.offsetWidth
  row.classList.add('row-call')
  window.setTimeout(() => row.classList.remove('row-call'), 1400)
}

/**
 * The game, in one card, in the Pokedex's own look: a night screen set into the
 * page. The partner and how today moved it, the pillars as rings that fill, the
 * week's pace, and what today is wearing down (the wild Pokemon, the leader, the boss).
 */
export function PartnerStrip({ game, pillars }: { game: Game; pillars: PillarRing[] }) {
  const { partner, today, momentum, wild, league } = game
  const pct = Math.max(0, Math.min(1, game.into / game.need))
  // the bar has two parts: what was banked before today, and what today added on top
  const before = Math.max(0, Math.min(pct, game.intoBeforeToday / game.need))
  const name = nameOf(game.display)
  const foe = leaderOf(league.index, league.slot)
  const toGo = Math.max(0, Math.ceil(xpForLevel(game.next.level) - partner.xp))
  // the seven days before today, oldest first, then today
  const prev = game.days.slice(-(MOMENTUM_WINDOW + 1), -1)
  const missing = MOMENTUM_WINDOW - prev.length
  const marks = marksToday(game)
  const say: ReactNode = wild?.caught ? <>Gotcha! <em>{nameOf(wild.form)}</em> was caught!</>
    : game.fled ? <>The wild {nameOf(game.fled)} got away. A new one is here.</>
    : game.asleep ? <>{name} is dozing. One pillar wakes it.</>
    : today.perfect ? <>Perfect day! <em>+{today.xp} XP</em></>
    : today.xp > 0 ? <>{name} gained <em>+<AnimatedNumber value={today.xp} /> XP</em> today</>
    : <>What will {name} do today?</>
  const boss = game.boss && !game.boss.caught && !game.boss.fled ? game.boss : null

  return (
    <section className={`dex-card ${game.aura ? `aura-${game.aura}` : ''}`} aria-label="Your partner">
      <div className="dex-top">
        <a href={POKEDEX_URL || undefined} target="_blank" rel="noreferrer" className="dex-hero" title="Open the Pokedex">
          <Sprite form={game.display} shiny={partner.shiny} size={88} dim={game.asleep} />
          {game.asleep && <span className="partner-zzz" aria-hidden>z z z</span>}
        </a>
        <div className="min-w-0 flex-1">
          <div className="dex-name-row">
            <span className="dex-name">{name}</span>
            <span className="dex-lv">Lv {game.level}</span>
            {partner.shiny && <span className="dex-chip">shiny</span>}
            {game.aura === 'mega' && <span className="dex-chip is-mega">mega</span>}
            {game.aura === 'gmax' && <span className="dex-chip is-gmax">g-max</span>}
          </div>
          <p className="dex-say" aria-live="polite">{say}</p>
          <div
            className="dex-xp"
            data-reward-target="xp"
            role="progressbar"
            aria-label={`Level ${game.level} progress`}
            aria-valuemin={0}
            aria-valuemax={game.need}
            aria-valuenow={Math.round(game.into)}
            aria-valuetext={`${Math.round(game.into)} of ${game.need} XP, ${Math.round(game.into - game.intoBeforeToday)} of it earned today`}
          >
            <motion.i className="bar-base" animate={{ width: `${before * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} />
            <motion.i className="bar-today" animate={{ width: `${(pct - before) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} />
          </div>
          <div className="dex-sub">
            <span className="num">{Math.round(game.into).toLocaleString('en-IN')} / {game.need.toLocaleString('en-IN')}</span>
            <span>{game.next.what === 'evolve' ? 'evolves' : 'fully trained'} at Lv {game.next.level} · <b className="num">{toGo.toLocaleString('en-IN')}</b> to go</span>
          </div>
        </div>
      </div>

      <div className="dex-wallet" title="Coins and gems: spend them in the Pokedex">
        <span className="dex-pill"><ItemPic id="coin" size={20} fallback="●" /><b className="num"><AnimatedNumber value={game.wallet.coins} /></b>{game.wallet.coinsToday > 0 && <small>+{game.wallet.coinsToday}</small>}</span>
        <span className="dex-pill"><ItemPic id="gem" size={20} fallback="◆" /><b className="num"><AnimatedNumber value={game.wallet.gems} /></b>{game.wallet.gemsToday > 0 && <small>+{game.wallet.gemsToday}</small>}</span>
        {marks > 0 && <span className="dex-pill" title="Marks earned today: spend them on mastery in the Pokedex"><b className="num">+{marks}</b><small>marks</small></span>}
        {game.held.length > 0 ? (
          <a href={POKEDEX_URL || undefined} target="_blank" rel="noreferrer" data-reward-target="collect" className="dex-collect breathe" title="Rewards wait in the Pokedex until you tap them, or pay themselves after three days">
            {game.held.length} to collect ↗
          </a>
        ) : (
          <span data-reward-target="collect" className="dex-collect is-empty">Nothing to collect</span>
        )}
      </div>

      {pillars.length > 0 && (
        <ul className="dex-pillars" aria-label="Today's pillars">
          {pillars.map((p) => {
            const st = p.done ? 'done' : p.frac > 0 ? 'part' : 'todo'
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={`dex-pillar ${st}`}
                  data-tag={p.tag}
                  style={{ ['--p' as string]: p.done ? 1 : p.frac }}
                  onClick={() => showRow(p.id)}
                  title={`${p.name}: ${Math.round(p.worth * (p.done ? 1 : p.frac))} of ${p.worth} XP. Tap to find it on the list.`}
                >
                  <span className="dex-ring">
                    <ItemPic id={MARK_ICON[p.tag] ?? 'journal'} size={26} fallback={p.emoji} />
                    {st === 'done' && <i className="dex-tick" aria-hidden />}
                  </span>
                  <b>{p.name}</b>
                  <small>{st === 'done' ? 'Done' : st === 'part' ? `${Math.round(p.frac * 100)}%` : `${p.worth} XP`}</small>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="dex-pace">
        <div className="dex-pace-cell" title="Days with two pillars in the last seven: 3 make XP ×1.2, 5 ×1.35, 7 ×1.5. It slides back a day at a time, never resets.">
          <span className="dex-label">Momentum</span>
          <span className="dex-week" aria-label={`${momentum.days} of the last 7 days counted`}>
            {Array.from({ length: MOMENTUM_WINDOW }, (_, i) => {
              const d = prev[i - missing]
              return <i key={i} className={d?.counts ? 'on' : d ? 'off' : 'none'} title={d ? `${d.day}: ${d.pillars} of ${d.pillarTotal} pillars` : 'before the game began'} />
            })}
            <i className={`now ${today.counts ? 'on' : ''}`} title={`Today: ${today.pillars} of ${today.pillarTotal} pillars`} />
          </span>
          {momentum.mult > 1 ? (
            <span className={`flame t${momentum.mult >= 1.5 ? 3 : momentum.mult >= 1.35 ? 2 : 1}`}><i aria-hidden /><b>×{momentum.mult}</b></span>
          ) : (
            <b className="dex-mult">×1</b>
          )}
        </div>
        {game.sleep.state !== 'off' && (
          <div className="dex-pace-cell" title={game.sleep.state === 'measured' ? 'Last night, as the band measured it' : 'The band has not reported last night yet'}>
            <span className="dex-label">Last night</span>
            <b className="dex-mult">{game.sleep.state === 'measured' ? game.sleep.score : '…'}</b>
          </div>
        )}
      </div>

      {(wild || (foe && !league.waiting) || boss) && (
        <div className="dex-foes">
          {wild && (
            <span className="dex-foe" title={wild.caught ? 'Caught today: the next one appears tomorrow' : `Today's ticks wear it down. A perfect day catches it on the spot.`}>
              <span className="dex-foe-art"><Sprite form={wild.form} shiny={wild.shiny} size={34} /></span>
              <span className="min-w-0 flex-1">
                <span className="dex-foe-name">{wild.caught ? `${nameOf(wild.form)} caught` : `Wild ${nameOf(wild.form)}`}</span>
                {!wild.caught && <HpBar hp={wild.hp} max={wild.max} />}
                <span className="dex-foe-line">
                  {wild.caught ? 'in your Box' : `${BALL_NAME[today.ball]}${wild.leavesIn !== undefined && wild.leavesIn <= 3 ? (wild.leavesIn === 0 ? ' · leaves tomorrow' : ` · leaves in ${wild.leavesIn + 1}d`) : ''}`}
                </span>
              </span>
            </span>
          )}
          {foe && !league.waiting && (
            <span className="dex-foe" title={`Gym leader, ${league.hp.toLocaleString('en-IN')} of ${league.max.toLocaleString('en-IN')} HP. Weak to ${league.weak.map((t) => WORK[t] ?? t).join(', ') || 'nothing in particular'}.`}>
              <span className="dex-foe-art is-badge" aria-hidden>★</span>
              <span className="min-w-0 flex-1">
                <span className="dex-foe-name">{foe.name}</span>
                <HpBar hp={league.hp} max={league.max} />
                <span className="dex-foe-line">{league.weak.length ? `weak to ${league.weak.map((t) => WORK[t] ?? t).join(', ')}` : 'gym leader'}</span>
              </span>
            </span>
          )}
          {boss && (
            <span className="dex-foe is-boss" title="This week's boss: its card is in the Pokedex">
              <span className="dex-foe-art"><Sprite form={boss.form} size={34} /></span>
              <span className="min-w-0 flex-1">
                <span className="dex-foe-name">Boss {nameOf(boss.form)}</span>
                <HpBar hp={boss.hpLeft * 100} max={100} />
                <span className="dex-foe-line">{Math.round(boss.hpLeft * 100)}% left · {boss.daysLeft === 0 ? 'last day' : `${boss.daysLeft}d left`}</span>
              </span>
            </span>
          )}
        </div>
      )}
    </section>
  )
}

function HpBar({ hp, max }: { hp: number; max: number }) {
  const f = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0
  return (
    <span className={`dex-hp ${f <= 0.2 ? 'low' : f <= 0.5 ? 'mid' : ''}`} role="img" aria-label={`${Math.round(hp)} of ${max} HP`}>
      <i style={{ width: `${f * 100}%` }} />
    </span>
  )
}

/** Level-ups, evolutions and catches, said once each, a few seconds at a time. */
/** The moments worth stopping for: they are staged in the middle of the screen, not slipped in at the bottom. */
const BIG = new Set<string>(['evolve', 'catch', 'graduate', 'gym', 'league', 'key', 'mega', 'hatch'])
/** A kind of work, said short, for a leader's weaknesses. */
const WORK: Record<string, string> = { code: 'Code', fitness: 'Gym', guitar: 'Guitar', arbor: 'Arbor', sleep: 'Sleep', routine: 'Chores' }
const marksToday = (g: Game): number => Object.values(g.wallet.marksToday ?? {}).reduce((a, b) => a + b, 0)

export function Moments({ game, today, ready }: { game: Game; today: string; ready: boolean }) {
  const [line, setLine] = useState<Moment[]>([])
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!ready) return // never announce a half-loaded ledger
    const fresh = freshMoments(game, today)
    if (!fresh.length) return
    // several level-ups in one tick: only the last one is worth saying
    const last = fresh.filter((m, i) => m.kind !== 'level' || !fresh.slice(i + 1).some((x) => x.kind === 'level'))
    // and a level-up still waiting its turn is stale once a newer one arrives
    const newerLevel = last.some((m) => m.kind === 'level')
    setLine((q) => [...q.filter((m) => !(newerLevel && m.kind === 'level')), ...last])
  }, [game, today, ready])

  const current = line[0]
  useEffect(() => {
    if (!current) return
    timer.current = window.setTimeout(() => setLine((q) => q.slice(1)), current.kind === 'level' ? 2600 : 5200)
    return () => window.clearTimeout(timer.current)
  }, [current])

  const text = current ? momentText(current) : null
  return (
    <div className={`moment-wrap ${current && BIG.has(current.kind) ? 'is-big' : ''}`} aria-live="polite">
      <AnimatePresence>
        {current && text && (
          <motion.button
            key={momentKey(current)}
            type="button"
            onClick={() => setLine((q) => q.slice(1))}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className={`moment moment-${current.kind} ${BIG.has(current.kind) ? 'moment-big' : ''}`}
          >
            {text.form && <span className="moment-art"><Sprite form={text.form} shiny={text.shiny} size={BIG.has(current.kind) ? 96 : 56} /></span>}
            <span className="min-w-0 text-left">
              <span className="moment-title">{text.title}</span>
              <span className="moment-text">{text.line}</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
