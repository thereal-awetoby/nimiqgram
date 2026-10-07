import { useState } from 'react'
import { deletePost } from '../lib/api'
import { isSameWalletAddress } from '../lib/walletAddress'

function PostOptionsMenu({ post, userWallet, token, onDeleted }) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)
  const canDelete = isSameWalletAddress(post.author?.wallet, userWallet)
    && post.redPacket?.status !== 'active'

  if (!canDelete) return null

  async function handleDelete(event) {
    event.preventDefault()
    event.stopPropagation()
    if (!window.confirm('Delete this post? Comments, likes, and bookmarks will also be removed. Tip records will remain in Activity.')) return

    setDeleting(true)
    setError(null)
    try {
      await deletePost(post.id, token)
      onDeleted?.(post.id)
    } catch (deleteError) {
      setError(deleteError.message)
      setOpen(true)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      style={{ position: 'relative', flex: '0 0 auto' }}
    >
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault()
          setError(null)
          setOpen((value) => !value)
        }}
        aria-label="Post options"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Post options"
        style={{
          width: 34,
          height: 34,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          borderRadius: '50%',
          background: open ? 'var(--bg-elevated)' : 'transparent',
          color: 'var(--text-muted)',
          fontSize: 20,
          lineHeight: 1,
          padding: 0,
        }}
      >
        ⋯
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            zIndex: 30,
            minWidth: 140,
            padding: 5,
            border: '1px solid var(--nav-border)',
            borderRadius: 10,
            background: 'var(--bg-color)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.14)',
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleDelete}
            disabled={deleting}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: 7,
              padding: '9px 10px',
              background: 'transparent',
              color: '#c34c46',
              textAlign: 'left',
              fontWeight: 600,
            }}
          >
            {deleting ? 'Deleting...' : 'Delete post'}
          </button>
          {error && <p role="alert" style={{ margin: '4px 6px 6px', color: '#e0245e', fontSize: 12 }}>{error}</p>}
        </div>
      )}
    </div>
  )
}

export default PostOptionsMenu
