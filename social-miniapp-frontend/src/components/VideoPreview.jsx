import { useState } from 'react'

function VideoPreview({ src, videoRef, controls = true, onLoadedData, style }) {
  const [poster, setPoster] = useState('')

  function capturePoster(event) {
    const video = event.currentTarget
    if (!poster && video.videoWidth && video.videoHeight) {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
        setPoster(canvas.toDataURL('image/jpeg', 0.82))
      } catch (err) {
        console.error('Poster capture failed (likely a CORS issue):', err)
      }
    }
    onLoadedData?.(event)
  }

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster || undefined}
      preload="auto"
      crossOrigin="anonymous"
      playsInline
      controls={controls}
      onLoadedData={capturePoster}
      style={style}
    />
  )
}

export default VideoPreview