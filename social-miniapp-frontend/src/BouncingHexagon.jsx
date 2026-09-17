import { useEffect, useRef } from 'react'

const HEX_COLOR = '#f2b705'
const EDGE_COLOR = '#f9d36d'
const SHADOW_LIGHT = '#b9b3a1'
const SHADOW_DARK = '#5a574d'

function hexPoints(cx, cy, radius) {
  const points = []
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30)
    const x = cx + radius * Math.cos(angle)
    const y = cy + radius * Math.sin(angle)
    points.push(`${x},${y}`)
  }
  return points.join(' ')
}

export default function BouncingHexagon({ theme = 'light' }) {
  const hexRef = useRef(null)
  const shadowRef = useRef(null)
  const textRef = useRef(null)
  const isDark = theme === 'dark'

  const bgColor = isDark ? '#121214' : '#f4f1ea'
  const shadowColor = isDark ? SHADOW_DARK : SHADOW_LIGHT
  const textColor = isDark ? '#f3f3f3' : '#1d1d1f'

  const outerHex = '120,40 280,40 360,150 280,260 120,260 40,150'
  const cells = [
    { cx: 110, cy: 90, r: 38 },
    { cx: 200, cy: 90, r: 38 },
    { cx: 290, cy: 90, r: 38 },
    { cx: 155, cy: 150, r: 38 },
    { cx: 245, cy: 150, r: 38 },
    { cx: 110, cy: 210, r: 38 },
    { cx: 200, cy: 210, r: 38 },
    { cx: 290, cy: 210, r: 38 },
  ]

  useEffect(() => {
    const animationDuration = 4000
    const cx = 340
    const groundY = 220
    const bounceHeight = 95
    const bounceDur = 620
    const squashAmount = 1.18
    const rotationPerBounce = 60

    const animationEnd = performance.now() + animationDuration
    let phaseStart = performance.now()
    let rot = 0
    let frameId
    let bounceCount = 0

    const bounceEase = (t) => Math.sin(t * Math.PI)
    const easeInOut = (t) =>
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

    const frame = (now) => {
      if (now >= animationEnd) {
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
        shadowRef.current.setAttribute('rx', 34 * (1 - (h / bounceHeight) * 0.6))
        shadowRef.current.setAttribute('opacity', 0.35 * (1 - (h / bounceHeight) * 0.5))
      }

      if (textRef.current) {
        if (bounceCount === 0) {
          const introP = Math.min(p / 0.9, 1)
          textRef.current.style.opacity = introP
          textRef.current.style.transform = `translateY(${(1 - introP) * 12}px) scale(${0.85 + introP * 0.15})`
        } else {
          const nearLanding = p < 0.08 || p > 0.9
          const thump = nearLanding ? 1.06 : 1
          textRef.current.style.opacity = 1
          textRef.current.style.transform = `translateY(0px) scale(${thump})`
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
  }, [])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: 320,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: bgColor,
        position: 'relative',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <svg
        viewBox="0 0 680 260"
        style={{ width: '90%', maxWidth: 680, height: 'auto', overflow: 'visible' }}
      >
        <ellipse ref={shadowRef} cx={340} cy={222} rx={34} ry={7} fill={shadowColor} opacity={0.35} />
        <g ref={hexRef}>
          <defs>
            <clipPath id="logoOuterHex">
              <polygon points={outerHex} />
            </clipPath>
          </defs>

          <g clipPath="url(#logoOuterHex)">
            {cells.map(({ cx, cy, r }, i) => (
              <polygon
                key={i}
                points={hexPoints(cx, cy, r)}
                fill={HEX_COLOR}
                stroke={EDGE_COLOR}
                strokeWidth={2}
                strokeLinejoin="round"
              />
            ))}
          </g>

          <polygon
            points={outerHex}
            fill="none"
            stroke={EDGE_COLOR}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </g>
      </svg>

      <div
        ref={textRef}
        style={{
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: textColor,
          opacity: 0,
          transformOrigin: 'center',
          transition: 'transform 0.08s ease-out',
        }}
      >
        Nimiqgram
      </div>
    </div>
  )
}