import { useState } from 'react'
import { formatPostDate } from '../lib/date'

function CommentThread({ comments, isLoggedIn, onReply, compact = false }) {
  const [replyTo, setReplyTo] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [submitting, setSubmitting] = useState(null)
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

  function renderComments(parentId = 'root', depth = 0) {
    return (childrenByParent[parentId] || []).map((comment) => (
      <div key={comment.id} style={{ marginBottom: compact ? 8 : 12, marginLeft: depth * (compact ? 14 : 18), fontSize: compact ? 13.5 : undefined, borderLeft: depth > 0 ? '1px solid var(--nav-border)' : 'none', paddingLeft: depth > 0 ? 8 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <strong style={{ fontSize: compact ? undefined : 13 }}>{comment.author?.username || comment.author?.wallet || 'User'}</strong>
          {formatPostDate(comment.createdAt) && <time dateTime={comment.createdAt} style={{ color: 'var(--text-muted)', fontSize: 11 }}>{formatPostDate(comment.createdAt)}</time>}
        </div>
        <div style={{ marginTop: 4, lineHeight: 1.4 }}>{comment.text}</div>
        {isLoggedIn && (
          <button type="button" onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)} style={{ marginTop: 4, padding: 0, border: 'none', background: 'transparent', color: 'var(--accent-color)', fontSize: 11, cursor: 'pointer' }}>
            {replyTo === comment.id ? 'Cancel' : 'Reply'}
          </button>
        )}
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