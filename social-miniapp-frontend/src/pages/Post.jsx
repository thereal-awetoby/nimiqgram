import { useEffect, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { addComment, getPost, getBookmarkStatus, bookmarkPost, removeBookmark, toggleLike, recordPostView, claimRedPacket } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import LoadingHexagon from '../components/LoadingHexagon'
import CommentThread from '../components/CommentThread'
import TipModal from '../components/TipModal'
import { formatPostDate } from '../lib/date'
import VideoPreview from '../components/VideoPreview'
import { usePendingTips } from '../hooks/usePendingTips'

function HeartIcon({ filled }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <path d="M12 21s-7.5-4.6-10-9.3C.5 8 2.2 4.5 6 4a5.6 5.6 0 0 1 6 3 5.6 5.6 0 0 1 6-3c3.8.5 5.5 4 4 7.7C19.5 16.4 12 21 12 21z" />
    </svg>
  )
}

function CommentIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3 1-4.5A8 8 0 1 1 21 12z" />
    </svg>
  )
}

function TipIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.3c0-1.1 1.1-2 2.5-2s2.5.7 2.5 1.8c0 2.5-5 1.7-5 4.2 0 1.1 1.1 1.9 2.5 1.9s2.5-.9 2.5-2" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

function BookmarkIcon({ filled }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 4.5A2.5 2.5 0 0 1 8.5 2h7A2.5 2.5 0 0 1 18 4.5V22l-6-3.5L6 22V4.5Z" />
    </svg>
  )
}

function ActionButton({ onClick, disabled, active, children, color = 'var(--text-muted)' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        background: active ? 'rgba(184, 121, 14, 0.1)' : 'transparent',
        border: 'none', borderRadius: 10, padding: '5px 6px',
        color: active ? '#b6780a' : color,
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600,
        minWidth: 48,
        flex: 1,
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  )
}

function Post() {
  const { postId } = useParams()
  const { token, isLoggedIn, user } = useAuth()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const [liked, setLiked] = useState(false)
  const [tippingPost, setTippingPost] = useState(null)
  const [activeTipId, setActiveTipId] = useState(null)
  const [claimMessage, setClaimMessage] = useState(null)

  // Applies a verified tip's amount to the current post's tipTotal. Used by
  // usePendingTips, which keeps polling even after TipModal is closed, so a
  // tip that verifies after the user dismisses the modal still updates the
  // icon on this page.
  const handleTipVerified = useCallback((tip) => {
    setPost((current) => (current && tip?.postId === current.id)
      ? { ...current, tipTotal: Number(current.tipTotal || 0) + Number(tip.amount || 0) }
      : current)
  }, [])

  const { trackTip, statusById } = usePendingTips(token, user?.wallet, handleTipVerified)

  useEffect(() => {
    let cancelled = false
    Promise.resolve()
      .then(() => {
        if (cancelled) return null
        setLoading(true)
        return getPost(postId)
      })
      .then((data) => {
        if (!cancelled && data) {
          setPost(data)
          setLiked(Boolean(data.likedByMe))
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    if (token) {
      getBookmarkStatus(postId, token).then((data) => setBookmarked(Boolean(data.bookmarked))).catch(() => {})
    }

    if (isLoggedIn && token) {
      recordPostView(token, postId)
        .then((result) => {
          if (!cancelled && result?.viewCount != null) {
            setPost((current) => current ? { ...current, viewCount: result.viewCount } : current)
          }
        })
        .catch(() => {})
    }

    return () => { cancelled = true }
  }, [postId, token, isLoggedIn])

  async function toggleBookmark() {
    if (!isLoggedIn) return
    try {
      if (bookmarked) await removeBookmark(postId, token)
      else await bookmarkPost(postId, token)
      setBookmarked((value) => !value)
      setPost((current) => current
        ? { ...current, bookmarkCount: Math.max(0, Number(current.bookmarkCount || 0) + (bookmarked ? -1 : 1)) }
        : current
      )
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleLike() {
    if (!isLoggedIn) return
    try {
      const result = await toggleLike(token, postId)
      setLiked(Boolean(result.liked))
      setPost((current) => current ? { ...current, likeCount: result.likeCount, likedByMe: result.liked } : current)
    } catch (err) {
      setError(err.message)
    }
  }

  async function submitComment(event, parentCommentId = null, textOverride = null) {
    event?.preventDefault()
    const text = (textOverride ?? draft).trim()
    if (!text || !isLoggedIn) return
    setSubmitting(true)
    setError(null)
    try {
      const comment = await addComment(token, postId, text, parentCommentId)
      setPost((current) => ({ ...current, comments: [...(current.comments || []), comment], commentCount: (current.commentCount || 0) + 1 }))
      if (!parentCommentId) setDraft('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleClaimRedPacket() {
    if (!isLoggedIn || !post?.redPacket) return
    try {
      const result = await claimRedPacket(token, post.redPacket.id)
      setPost((current) => current ? { ...current, redPacket: { ...current.redPacket, remainingAmount: result.remainingAmount, claimedCount: result.claimedCount, status: result.status } } : current)
      setClaimMessage(`You claimed ${result.amount} NIM.`)
    } catch (err) {
      setClaimMessage(err.message)
    }
  }

  if (loading) return <LoadingHexagon label="Loading post" />
  if (error) return <p style={{ padding: 16, color: '#e0245e' }}>{error}</p>
  if (!post) return <p style={{ padding: 16, color: 'var(--text-muted)' }}>Post not found.</p>

  return (
    <div style={{ padding: 16, maxWidth: 560, margin: '0 auto' }}>
      <Link to="/" aria-label="Back to feed" title="Back to feed" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, color: 'var(--accent-color)', border: '1px solid var(--nav-border)', borderRadius: '50%' }}>
        <BackIcon />
      </Link>

      <article style={{ marginTop: 18, paddingBottom: 20, borderBottom: '1px solid var(--nav-border)' }}>
        <Link to={`/profile/${encodeURIComponent(post.author?.wallet || '')}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'inherit' }}>
          <Avatar url={post.author?.avatarUrl} fallback={post.author?.username || post.author?.wallet} />
          <div>
            <strong>{post.author?.displayName || post.author?.username || post.author?.wallet}</strong>
            {post.author?.username && <div style={{ color: 'var(--accent-color)', fontSize: 12 }}>@{post.author.username}</div>}
            {formatPostDate(post.createdAt) && <time dateTime={post.createdAt} style={{ display: 'block', marginTop: 2, color: 'var(--text-muted)', fontSize: 11.5 }}>{formatPostDate(post.createdAt)}</time>}
          </div>
        </Link>

        <p style={{ margin: '18px 0 12px', fontSize: 17, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{post.text}</p>
        {post.mediaUrl && post.mediaType === 'video' && <VideoPreview src={post.mediaUrl} style={{ width: '100%', maxHeight: 480, borderRadius: 12 }} />}
        {post.mediaUrl && post.mediaType !== 'video' && <img src={post.mediaUrl} alt="" style={{ display: 'block', width: '100%', maxHeight: 480, objectFit: 'contain', borderRadius: 12 }} />}
        {post.redPacket && (
          <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--tip-accent)', borderRadius: 12, background: 'rgba(200, 139, 20, 0.08)' }}>
            <strong style={{ color: 'var(--tip-accent)' }}>Red packet</strong>
            <div style={{ marginTop: 4, fontSize: 13 }}>{post.redPacket.remainingAmount} NIM remaining for {Math.max(0, Number(post.redPacket.claimLimit) - Number(post.redPacket.claimedCount))} people</div>
            <button onClick={handleClaimRedPacket} disabled={!isLoggedIn || post.redPacket.status !== 'active'} style={{ marginTop: 8, border: 'none', borderRadius: 20, padding: '7px 14px', background: 'var(--tip-accent)', color: 'var(--bg-color)', fontWeight: 700 }}>
              {post.redPacket.status === 'active' ? 'Claim' : 'Closed'}
            </button>
            {claimMessage && <div style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: 12 }}>{claimMessage}</div>}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '6px 2px 0',
            marginTop: 12,
            gap: 2,
          }}
        >
          <ActionButton onClick={() => document.getElementById('post-comment-input')?.focus()} active={false} color="var(--comment-accent)">
            <CommentIcon /> {post.commentCount ?? 0}
          </ActionButton>
          <ActionButton onClick={handleLike} disabled={!isLoggedIn} active={liked} color="var(--like-accent)">
            <HeartIcon filled={liked} /> {post.likeCount ?? 0}
          </ActionButton>
          <ActionButton onClick={() => setTippingPost(post)} disabled={!isLoggedIn} color="var(--tip-accent)">
            <TipIcon /> {post.tipTotal ?? 0}
          </ActionButton>
          <ActionButton disabled color="var(--view-accent)">
            <EyeIcon /> {post.viewCount ?? 0}
          </ActionButton>
          {isLoggedIn && (
            <ActionButton onClick={toggleBookmark} active={bookmarked} color="var(--accent-color)">
              <span aria-label={bookmarked ? 'Remove bookmark' : 'Save bookmark'} title={bookmarked ? 'Remove bookmark' : 'Save bookmark'}>
                <BookmarkIcon filled={bookmarked} /> {post.bookmarkCount ?? 0}
              </span>
            </ActionButton>
          )}
        </div>
      </article>

      <section style={{ paddingTop: 18 }}>
        <h2 style={{ fontSize: 18, margin: '0 0 14px' }}>Comments</h2>
        {isLoggedIn ? (
          <form onSubmit={submitComment} style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <input id="post-comment-input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a comment..." style={{ flex: 1 }} />
            <button type="submit" disabled={submitting || !draft.trim()} style={{ background: 'var(--accent-color)', color: 'var(--bg-color)', border: 'none', borderRadius: 8, padding: '0 14px', fontWeight: 700 }}>{submitting ? '...' : 'Reply'}</button>
          </form>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Connect your wallet to comment.</p>
        )}
        {error && <p style={{ color: '#e0245e', fontSize: 13 }}>{error}</p>}
        {(post.comments || []).length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No comments yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CommentThread
              comments={post.comments}
              isLoggedIn={isLoggedIn}
              token={token}
              onReply={(commentId, text) => submitComment(null, commentId, text)}
            />
          </div>
        )}
      </section>

      {tippingPost && (
        <TipModal
          post={tippingPost}
          onClose={() => { setTippingPost(null); setActiveTipId(null) }}
          onPending={(result) => {
            trackTip(result?.id, { postId: tippingPost.id, amount: Number(result?.amount) })
            setActiveTipId(result?.id)
          }}
          verificationStatus={activeTipId ? statusById[activeTipId] : undefined}
          onSuccess={(result) => {
            if (result?.status === 'verified' && post && post.id === tippingPost.id) {
              setPost((current) => ({ ...current, tipTotal: Number(current.tipTotal || 0) + Number(result.amount || 0) }))
              setTippingPost(null)
              setActiveTipId(null)
            }
          }}
        />
      )}
    </div>
  )
}

export default Post