import { useEffect, useRef } from 'react'

const HEX_LIGHT = '#fbc02d'
const HEX_DARK = '#f39c12'
const EDGE_COLOR = '#fddc85'
const SHADOW_LIGHT = '#b9b3a1'
const SHADOW_DARK = '#5a574d'

// --- Honeycomb logo geometry (flat-top/bottom, pointy left/right hexagons) ---

const hexVerts = (cx, cy, r) => {
  const h = r * 0.8660254
  return [
    [cx + r, cy],
    [cx + r / 2, cy + h],
    [cx - r / 2, cy + h],
    [cx - r, cy],
    [cx - r / 2, cy - h],
    [cx + r / 2, cy - h],
  ]
}

const norm = ([x, y]) => {
  const len = Math.hypot(x, y) || 1
  return [x / len, y / len]
}

// Rounds every corner of a closed polygon by `radius`.
const roundedPolyPath = (pts, radius) => {
  const n = pts.length
  let d = ''
  for (let i = 0; i < n; i++) {
    const curr = pts[i]
    const prev = pts[(i - 1 + n) % n]
    const next = pts[(i + 1) % n]
    const [tx1, ty1] = norm([prev[0] - curr[0], prev[1] - curr[1]])
    const [tx2, ty2] = norm([next[0] - curr[0], next[1] - curr[1]])
    const p1 = [curr[0] + tx1 * radius, curr[1] + ty1 * radius]
    const p2 = [curr[0] + tx2 * radius, curr[1] + ty2 * radius]
    d += (i === 0 ? `M ${p1[0]} ${p1[1]} ` : `L ${p1[0]} ${p1[1]} `)
    d += `Q ${curr[0]} ${curr[1]} ${p2[0]} ${p2[1]} `
  }
  return d + 'Z'
}

// 7-cell "flower" honeycomb: one center cell + 6 neighbors, same orientation
// as the outer silhouette. Computed once at module load — it never changes
// between animation frames, only the wrapping <g> transform does.
const CELL_R = 54
const OUTER_R = 136
const OUTER_CORNER_RADIUS = 16

const cellCenters = [
  [0, 0],
  [0, -CELL_R * 1.7320508],
  [0, CELL_R * 1.7320508],
  [CELL_R * 1.5, -CELL_R * 0.8660254],
  [CELL_R * 1.5, CELL_R * 0.8660254],
  [-CELL_R * 1.5, -CELL_R * 0.8660254],
  [-CELL_R * 1.5, CELL_R * 0.8660254],
]

const outerPath = roundedPolyPath(hexVerts(0, 0, OUTER_R), OUTER_CORNER_RADIUS)
const cellPaths = cellCenters.map(([cx, cy]) => hexVerts(cx, cy, CELL_R).map(p => p.join(',')).join(' '))

export function HoneycombLogo({ clipId, gradId }) {
  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <path d={outerPath} />
        </clipPath>
      </defs>
      <path d={outerPath} fill={`url(#${gradId})`} stroke={EDGE_COLOR} strokeWidth={3} />
      <g clipPath={`url(#${clipId})`}>
        {cellPaths.map((pts, i) => (
          <polygon key={i} points={pts} fill="none" stroke={EDGE_COLOR} strokeWidth={2.5} opacity={0.8} />
        ))}
      </g>
    </g>
  )
}

// Static (non-animated) version of the honeycomb mark, sized for use as an
// app icon/header logo — same geometry as the bouncing splash animation.
export function HexIcon({ size = 34, gradId = 'hexIconGrad' }) {
  return (
    <svg viewBox="-150 -130 300 260" width={size} height={size} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={HEX_LIGHT} />
          <stop offset="100%" stopColor={HEX_DARK} />
        </linearGradient>
      </defs>
      <HoneycombLogo clipId={`${gradId}-clip`} gradId={gradId} />
    </svg>
  )
}

export default function BouncingHexagon({ theme = 'light', loops = Infinity, label = 'Nimiqgram' }) {
  const hexRef = useRef(null)
  const shadowRef = useRef(null)
  const textRef = useRef(null)
  const isDark = theme === 'dark'

  const bgColor = isDark ? '#121214' : '#f4f1ea'
  const shadowColor = isDark ? SHADOW_DARK : SHADOW_LIGHT
  const textColor = isDark ? '#f3f3f3' : '#1d1d1f'

  useEffect(() => {
    const cx = 170
    const groundY = 176
    const bounceHeight = 120
    const bounceDur = 780
    const squashAmount = 1.18
    const rotationPerBounce = 60

    let phaseStart = performance.now()
    let rot = 0
    let bounceCount = 0
    let frameId

    const bounceEase = (t) => Math.sin(t * Math.PI)
    const easeInOut = (t) =>
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

    const frame = (now) => {
      if (bounceCount >= loops) {
        cancelAnimationFrame(frameId)
        return
      }

      const elapsed = now - phaseStart
      const p = Math.min(elapsed / bounceDur, 1)

      const h = bounceEase(p) * bounceHeight
      const squash = p < 0.06 || p > 0.94 ? squashAmount : 1
      const curRot = rot + easeInOut(p) * rotationPerBounce

      if (hexRef.current) {
        hexRef.current.setAttribute(
          'transform',
          `translate(${cx}, ${groundY - h}) rotate(${curRot}) scale(1, ${1 / squash})`
        )
      }

      if (shadowRef.current) {
        shadowRef.current.setAttribute('rx', 18 * (1 - (h / bounceHeight) * 0.6))
        shadowRef.current.setAttribute('opacity', 0.35 * (1 - (h / bounceHeight) * 0.5))
      }

      if (textRef.current) {
        if (bounceCount === 0) {
          const introP = Math.min(p / 0.9, 1)
          textRef.current.style.opacity = introP
          textRef.current.style.transform = `translateY(${(1 - introP) * 12}px) scale(${0.85 + introP * 0.15})`
        } else {
          const nearLanding = p < 0.08 || p > 0.9
          textRef.current.style.opacity = 1
          textRef.current.style.transform = `translateY(${nearLanding ? -6 : 0}px) scale(${nearLanding ? 1.2 : 1})`
        }
      }

      if (p >= 1) {
        rot = (rot + rotationPerBounce) % 360
        phaseStart = now
        bounceCount += 1
      }

      frameId = requestAnimationFrame(frame)
    }

    frameId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(frameId)
  }, [loops])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: 240,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: bgColor,
        position: 'relative',
        flexDirection: 'column',
        gap: 20,
        padding: '32px 24px',
      }}
    >
      <svg
        viewBox="0 0 340 240"
        style={{ width: '60%', maxWidth: 280, height: 'auto', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="hexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={HEX_LIGHT} />
            <stop offset="100%" stopColor={HEX_DARK} />
          </linearGradient>
        </defs>

        <ellipse ref={shadowRef} cx={170} cy={178} rx={18} ry={4.5} fill={shadowColor} opacity={0.35} />

        <g ref={hexRef}>
          <g transform="scale(0.16)">
            <HoneycombLogo clipId="honeycombClip" gradId="hexGrad" />
          </g>
        </g>
      </svg>

      <div
        ref={textRef}
        style={{
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: textColor,
          opacity: 0,
          transformOrigin: 'center',
          transition: 'transform 0.08s ease-out',
        }}
      >
        {label}
      </div>
    </div>
  )
}