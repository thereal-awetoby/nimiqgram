function Avatar({ url, fallback, size = 40 }) {
  return url ? (
    <img
      src={url}
      alt=""
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
    />
  ) : (
    <div
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: 'var(--bg-elevated)', border: '1px solid var(--nav-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: size * 0.4,
      }}
    >
      {(fallback || '?').slice(0, 1).toUpperCase()}
    </div>
  )
}

export default Avatar