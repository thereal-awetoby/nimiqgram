function NimiqWatermark() {
  return (
    <svg
      viewBox="0 0 400 350"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(70vw, 500px)',
        height: 'auto',
        opacity: 'var(--watermark-opacity)',
        pointerEvents: 'none',
        zIndex: -1,
      }}
    >
      <polygon
        points="100,10 300,10 390,175 300,340 100,340 10,175"
        fill="var(--accent-color)"
      />
    </svg>
  )
}

export default NimiqWatermark