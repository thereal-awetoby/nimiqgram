function LoadingHexagon({ label = 'Loading' }) {
  return (
    <div className="loading-hexagon" role="status" aria-label={label}>
      <div className="loading-hexagon__shape" />
      <div className="loading-hexagon__shadow" />
    </div>
  )
}

export default LoadingHexagon