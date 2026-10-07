const API_BASE = (() => {
  const configuredBase = (import.meta.env.VITE_API_BASE || '').trim().replace(/\/+$/, '')
  if (configuredBase) return configuredBase

  const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  return isLocalHost ? 'http://localhost:3001/api' : 'https://nimsoc.onrender.com/api'
})()

function formatErrorMessage(status, responseText) {
  let payload
  try {
    payload = JSON.parse(responseText)
  } catch {
    payload = null
  }

  const message = payload?.error ?? payload?.message
  if (typeof message === 'string' && message.trim()) return message.trim()

  if (message && typeof message === 'object') {
    const fieldErrors = Object.entries(message.fieldErrors || {})
      .flatMap(([field, errors]) => (Array.isArray(errors) ? errors.map((error) => `${field}: ${error}`) : []))
    const formErrors = Array.isArray(message.formErrors) ? message.formErrors : []
    const details = [...fieldErrors, ...formErrors].filter(Boolean)
    if (details.length) return details.join('. ')
  }

  if (status === 503) return 'The server is temporarily unavailable. Please try again.'
  if (status === 401) return 'Your session has expired. Please connect your wallet again.'
  if (status === 403) return 'You are not allowed to perform this action.'
  if (status === 404) return 'The requested item could not be found.'
  if (status >= 500) return 'The server could not complete your request. Please try again.'
  return 'Please check your information and try again.'
}

const RETRYABLE_STATUS_CODES = new Set([502, 503, 504])
const MAX_REQUEST_ATTEMPTS = 3
const REQUEST_TIMEOUT_MS = 20_000

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

async function request(path, options = {}) {
  const { retryable = (options.method || 'GET').toUpperCase() === 'GET', ...requestOptions } = options
  const attempts = retryable ? MAX_REQUEST_ATTEMPTS : 1

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let res
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      res = await fetch(`${API_BASE}${path}`, {
        ...requestOptions,
        signal: controller.signal,
        headers: {
          ...(requestOptions.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(requestOptions.headers || {}),
        },
      })
    } catch (error) {
      if (attempt < attempts && (error instanceof TypeError || error?.name === 'AbortError')) {
        await wait(1000 * attempt)
        continue
      }
      if (error instanceof TypeError || error?.name === 'AbortError') {
        throw new Error("Can't reach Nimiqgram's server. Check your connection and try again.", { cause: error })
      }
      throw error
    } finally {
      window.clearTimeout(timeout)
    }

    if (res.ok) return res.json()

    const errText = await res.text().catch(() => '')
    if (attempt < attempts && RETRYABLE_STATUS_CODES.has(res.status)) {
      await wait(1000 * attempt)
      continue
    }
    throw new Error(formatErrorMessage(res.status, errText))
  }

  throw new Error("Can't reach Nimiqgram's server. Check your connection and try again.")
}

export function getServerHealth() {
  return request('/health')
}

export function getChallenge(wallet) {
  return request('/auth/challenge', {
    method: 'POST',
    body: JSON.stringify({ wallet }),
  })
}

export function verifyAuth({ wallet, publicKey, signature }) {
  return request('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ wallet, publicKey, signature }),
  })
}

export function authedRequest(path, token, options = {}) {
  return request(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  })
}

export function getProfile(wallet) {
  return request(`/profile/${wallet}`)
}

export function updateProfile(token, { displayName, username, bio, avatarUrl, bannerUrl }) {
  return authedRequest('/profile', token, {
    method: 'PUT',
    body: JSON.stringify({ displayName, username, bio, avatarUrl, bannerUrl }),
  })
}

export function getFeed(cursor, token, scope = 'all') {
  const params = new URLSearchParams()
  if (cursor) params.set('cursor', cursor)
  if (scope && scope !== 'all') params.set('scope', scope)

  const query = params.toString() ? `?${params.toString()}` : ''
  if (token) {
    return authedRequest(`/feed${query}`, token)
  }
  return request(`/feed${query}`)
}

export function getFollowing(wallet) {
  return request(`/users/${wallet}/following`)
}

export function getFollowers(wallet) {
  return request(`/users/${wallet}/followers`)
}

export function getFollowStatus(wallet, token) {
  return authedRequest(`/users/${wallet}/follow-status`, token)
}

export function followUser(wallet, token) {
  return authedRequest(`/users/${wallet}/follow`, token, { method: 'POST', body: JSON.stringify({}), retryable: true })
}

export function unfollowUser(wallet, token) {
  return authedRequest(`/users/${wallet}/follow`, token, { method: 'DELETE', retryable: true })
}

export function deletePost(postId, token) {
  return authedRequest(`/posts/${postId}`, token, { method: 'DELETE' })
}

export function createPost(token, { text, mediaUrl, mediaType }) {
  return authedRequest('/posts', token, {
    method: 'POST',
    body: JSON.stringify({ text, mediaUrl, mediaType }),
  })
}

export function createRedPacket(token, { amount, claimLimit, expiresAt }) {
  return authedRequest('/red-packets', token, {
    method: 'POST',
    body: JSON.stringify({ amount, claimLimit, expiresAt }),
  })
}

export function fundRedPacket(token, packetId, { txHash }) {
  return authedRequest(`/red-packets/${packetId}/fund`, token, {
    method: 'POST',
    body: JSON.stringify({ txHash }),
  })
}

export function claimRedPacket(token, packetId) {
  return authedRequest(`/red-packets/${packetId}/claim`, token, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function getPost(postId) {
  return request(`/posts/${postId}`)
}

export function toggleLike(token, postId) {
  return authedRequest(`/posts/${postId}/like`, token, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function toggleCommentLike(token, commentId) {
  return authedRequest(`/comments/${commentId}/like`, token, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function recordPostView(token, postId) {
  return authedRequest(`/posts/${postId}/view`, token, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function addComment(token, postId, text, parentCommentId = null) {
  return authedRequest(`/posts/${postId}/comment`, token, {
    method: 'POST',
    body: JSON.stringify({ text, parentCommentId }),
  })
}

export function sendTip(token, { toWallet, postId, amount, txHash }) {
  return authedRequest('/tips', token, {
    method: 'POST',
    body: JSON.stringify({ toWallet, postId, amount, txHash }),
  })
}

export function verifyTip(token, tipId) {
  return authedRequest(`/tips/${tipId}/verify`, token, {
    method: 'POST',
    body: JSON.stringify({}),
    retryable: true,
  })
}

export function getLeaderboard(range = 'daily') {
  return request(`/tips/leaderboard?range=${range}`)
}

export function getNotifications(token) {
  return authedRequest('/notifications', token)
}

export function markNotificationsRead(token, ids) {
  return authedRequest('/notifications/read', token, {
    method: 'POST',
    body: JSON.stringify(ids ? { ids } : {}),
  })
}

export function getStreaks(wallet) {
  return request(`/streaks/${wallet}`)
}

export function searchApp(query) {
  return request(`/search?q=${encodeURIComponent(query)}`)
}

export function getProfilePosts(wallet) { return request(`/users/${wallet}/posts`) }
export function getProfileLikes(wallet) { return request(`/users/${wallet}/likes`) }
export function getTipActivity(wallet) { return request(`/users/${wallet}/tip-activity`) }
export function getBookmarks(wallet, token) { return authedRequest(`/users/${wallet}/bookmarks`, token) }
export function bookmarkPost(postId, token) { return authedRequest(`/posts/${postId}/bookmark`, token, { method: 'POST', body: JSON.stringify({}) }) }
export function removeBookmark(postId, token) { return authedRequest(`/posts/${postId}/bookmark`, token, { method: 'DELETE' }) }
export function getBookmarkStatus(postId, token) { return token ? authedRequest(`/posts/${postId}/bookmark`, token) : Promise.resolve({ bookmarked: false }) }