import { useState } from 'react'
import { formatPostDate } from '../lib/date'
import { toggleCommentLike } from '../lib/api'

function HeartIcon({ filled }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 21s-7.5-4.6-10-9.3C.5 8 2.2 4.5 6 4a5.6 5.6 0 0 1 6 3 5.6 5.6 0 0 1 6-3c3.8.5 5.5 4 4 7.7C19.5 16.4 12 21 12 21z" />
    </svg>
  )
}

function ReplyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3 1-4.5A8 8 0 1 1 21 12Z" />
    </svg>
  )
}

function CommentThread({ comments, isLoggedIn, token, onReply, compact = false }) {
  const [replyTo, setReplyTo] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [submitting, setSubmitting] = useState(null)
  const [likeState, setLikeState] = useState({})
  const childrenByParent = comments.reduce((groups, comment) => {
    const parentId = comment.parentCommentId || 'root'
    groups[parentId] = [...(groups[parentId] || []), comment]
    return groups
  }, {})

  async function submitReply(commentId) {
    const text = drafts[commentId]?.trim()
    if (!text) return
    setSubmitting(commentId)
    try {
      await onReply(commentId, text)
      setDrafts((current) => ({ ...current, [commentId]: '' }))
      setReplyTo(null)
    } finally {
      setSubmitting(null)
    }
  }

  async function toggleLike(comment) {
    if (!isLoggedIn || !token) return
    const current = likeState[comment.id] || { liked: Boolean(comment.likedByMe), count: Number(comment.likeCount || 0) }
    const result = await toggleCommentLike(token, comment.id)
    setLikeState((state) => ({ ...state, [comment.id]: { liked: Boolean(result.liked), count: Number(result.likeCount || 0) } }))
    return current
  }

  function renderComments(parentId = 'root', depth = 0) {
    return (childrenByParent[parentId] || []).map((comment) => (
      <div key={comment.id} style={{ marginBottom: compact ? 8 : 12, marginLeft: depth * (compact ? 14 : 18), fontSize: compact ? 13.5 : undefined, borderLeft: depth > 0 ? '1px solid var(--nav-border)' : 'none', paddingLeft: depth > 0 ? 8 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <strong style={{ fontSize: compact ? undefined : 13 }}>{comment.author?.username || comment.author?.wallet || 'User'}</strong>
          {formatPostDate(comment.createdAt) && <time dateTime={comment.createdAt} style={{ color: 'var(--text-muted)', fontSize: 11 }}>{formatPostDate(comment.createdAt)}</time>}
        </div>
        <div style={{ marginTop: 4, lineHeight: 1.4 }}>{comment.text}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 5 }}>
          {isLoggedIn && (
            <button type="button" onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0, border: 'none', background: 'transparent', color: 'var(--comment-accent)', fontSize: 11, cursor: 'pointer' }}>
              <ReplyIcon /> {replyTo === comment.id ? 'Cancel' : 'Reply'}
            </button>
          )}
          {(() => {
            const state = likeState[comment.id]
            const liked = state?.liked ?? Boolean(comment.likedByMe)
            const count = state?.count ?? Number(comment.likeCount || 0)
            return (
              <button type="button" onClick={() => toggleLike(comment).catch(() => {})} disabled={!isLoggedIn} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0, border: 'none', background: 'transparent', color: liked ? 'var(--like-accent)' : 'var(--text-muted)', fontSize: 11, cursor: isLoggedIn ? 'pointer' : 'default' }}>
                <HeartIcon filled={liked} /> {count}
              </button>
            )
          })()}
        </div>
        {replyTo === comment.id && (
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input
              value={drafts[comment.id] || ''}
              onChange={(event) => setDrafts((current) => ({ ...current, [comment.id]: event.target.value }))}
              onKeyDown={(event) => { if (event.key === 'Enter') submitReply(comment.id) }}
              placeholder="Write a reply..."
              autoFocus
              style={{ flex: 1, fontSize: 12 }}
            />
            <button type="button" onClick={() => submitReply(comment.id)} disabled={submitting === comment.id || !drafts[comment.id]?.trim()} style={{ background: 'transparent', border: '1px solid var(--nav-border)', borderRadius: 8, color: 'var(--accent-color)', fontSize: 12 }}>
              {submitting === comment.id ? '...' : 'Send'}
            </button>
          </div>
        )}
        {renderComments(comment.id, depth + 1)}
      </div>
    ))
  }

  return renderComments()
}

export default CommentThread