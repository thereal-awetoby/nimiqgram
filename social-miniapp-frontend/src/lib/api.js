const API_BASE = 'https://nimsoc.onrender.com/api'

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`API error ${res.status}: ${errText}`)
  }

  return res.json()
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

export function updateProfile(token, { displayName, username, bio, avatarUrl }) {
  return authedRequest('/profile', token, {
    method: 'PUT',
    body: JSON.stringify({ displayName, username, bio, avatarUrl }),
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

export function getFollowStatus(wallet, token) {
  return authedRequest(`/users/${wallet}/follow-status`, token)
}

export function followUser(wallet, token) {
  return authedRequest(`/users/${wallet}/follow`, token, { method: 'POST', body: JSON.stringify({}) })
}

export function unfollowUser(wallet, token) {
  return authedRequest(`/users/${wallet}/follow`, token, { method: 'DELETE' })
}

export function createPost(token, { text, mediaUrl, mediaType }) {
  return authedRequest('/posts', token, {
    method: 'POST',
    body: JSON.stringify({ text, mediaUrl, mediaType }),
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

export function recordPostView(token, postId) {
  return authedRequest(`/posts/${postId}/view`, token, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function addComment(token, postId, text) {
  return authedRequest(`/posts/${postId}/comment`, token, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

export function sendTip(token, { toWallet, postId, amount, txHash }) {
  return authedRequest('/tips', token, {
    method: 'POST',
    body: JSON.stringify({ toWallet, postId, amount, txHash }),
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