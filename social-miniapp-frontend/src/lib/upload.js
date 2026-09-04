// Uploads a file (image, gif, or video) to Cloudinary's free tier
// and returns the public URL. Replace CLOUD_NAME and UPLOAD_PRESET
// with your own values from the Cloudinary dashboard.

const CLOUD_NAME = 'x5rjwaf1'
const UPLOAD_PRESET = 'social-miniapp'

export async function uploadMedia(file) {
  const isVideo = file.type.startsWith('video/')
  const resourceType = isVideo ? 'video' : 'image'

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
    { method: 'POST', body: formData }
  )

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Upload failed: ${errText}`)
  }

  const data = await res.json()
  return {
    url: data.secure_url,
    duration: data.duration || null, // seconds, only present for video
  }
}

export function getMediaType(file) {
  if (file.type === 'image/gif') return 'gif'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('image/')) return 'image'
  return null
}