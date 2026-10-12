// A reward that leaves the row it was earned on and is pulled into the place it
// is kept: pushed out a little, away from the target, then drawn in fast like
// a magnet, and the target pulses when it lands. Pure DOM + Web Animations, so
// it works from a timer without going through React.

const reduced = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/** Where the day's XP lands: the partner's XP bar. */
export const XP_TARGET = '[data-reward-target="xp"]'

export function flyReward(from: Element, label: string, targetSelector: string = XP_TARGET): void {
  const target = document.querySelector(targetSelector)
  if (!target || reduced()) return
  const a = from.getBoundingClientRect()
  const b = target.getBoundingClientRect()
  const sx = a.left + a.width - 56
  const sy = a.top + a.height / 2
  const tx = b.left + Math.min(b.width * 0.5, 120)
  const ty = b.top + b.height / 2
  // the push-out: a short move directly away from the target
  const len = Math.hypot(tx - sx, ty - sy) || 1
  const px = sx - ((tx - sx) / len) * 26
  const py = sy - ((ty - sy) / len) * 26

  const el = document.createElement('div')
  el.className = 'fly-reward'
  el.textContent = label
  el.setAttribute('aria-hidden', 'true')
  document.body.appendChild(el)
  const at = (x: number, y: number, s: number, o = 1): Keyframe => ({ transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})`, opacity: o })
  const anim = el.animate(
    [
      { ...at(sx, sy, 0.6, 0), offset: 0 },
      { ...at(px, py, 1.25), offset: 0.3, easing: 'cubic-bezier(.7,0,.95,.5)' }, // pushed out, then the pull accelerates
      { ...at(tx, ty, 0.55), offset: 0.92 },
      { ...at(tx, ty, 0.3, 0), offset: 1 },
    ],
    { duration: 760, fill: 'forwards', easing: 'cubic-bezier(.2,.8,.3,1)' },
  )
  const done = () => {
    el.remove()
    target.classList.remove('reward-pulse')
    void (target as HTMLElement).offsetWidth // restart the pulse if two land together
    target.classList.add('reward-pulse')
    window.setTimeout(() => target.classList.remove('reward-pulse'), 400)
  }
  anim.onfinish = done
  anim.oncancel = () => el.remove()
}
