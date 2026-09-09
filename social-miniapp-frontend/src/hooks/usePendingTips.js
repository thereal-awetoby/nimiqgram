import { useCallback, useEffect, useRef, useState } from 'react'
import { getTipActivity, verifyTip } from '../lib/api'

const POLL_INTERVAL_MS = 3000
const MAX_ATTEMPTS = 10

// Tracks pending tips independently of any single component's lifecycle.
// TipModal is expected to be closed by the user while a tip is still
// verifying — polling must survive that, so it lives here instead, owned
// by a long-lived parent (Feed/Post) that stays mounted.
export function usePendingTips(token, wallet, onVerified) {
  const [statusById, setStatusById] = useState({})
  const metaByIdRef = useRef(new Map())
  const attemptsByIdRef = useRef(new Map())
  const timersByIdRef = useRef(new Map())

  const stopTracking = useCallback((tipId) => {
    const timer = timersByIdRef.current.get(tipId)
    if (timer) window.clearTimeout(timer)
    timersByIdRef.current.delete(tipId)
    attemptsByIdRef.current.delete(tipId)
    metaByIdRef.current.delete(tipId)
  }, [])

  const poll = useCallback(async (tipId) => {
    const attempts = (attemptsByIdRef.current.get(tipId) || 0) + 1
    attemptsByIdRef.current.set(tipId, attempts)

    try {
      const result = await verifyTip(token, tipId)
      if (result?.status === 'verified') {
        setStatusById((prev) => ({ ...prev, [tipId]: 'verified' }))
        const meta = metaByIdRef.current.get(tipId)
        onVerified?.({ ...result, ...meta })
        stopTracking(tipId)
        return
      }
      if (result?.status === 'invalid') {
        setStatusById((prev) => ({ ...prev, [tipId]: 'invalid' }))
        stopTracking(tipId)
        return
      }
    } catch (err) {
      console.error('Tip verification poll failed', err)
    }

    if (attempts >= MAX_ATTEMPTS) {
      setStatusById((prev) => ({ ...prev, [tipId]: 'timed_out' }))
      stopTracking(tipId)
      return
    }

    const timer = window.setTimeout(() => poll(tipId), POLL_INTERVAL_MS)
    timersByIdRef.current.set(tipId, timer)
  }, [onVerified, stopTracking, token])

  // meta (e.g. { postId, amount }) is stashed here rather than trusted from
  // the eventual verifyTip response, so callers don't depend on the backend
  // echoing those fields back.
  const trackTip = useCallback((tipId, meta = {}) => {
    if (!tipId || timersByIdRef.current.has(tipId)) return
    metaByIdRef.current.set(tipId, meta)
    setStatusById((prev) => ({ ...prev, [tipId]: 'pending' }))
    const timer = window.setTimeout(() => poll(tipId), POLL_INTERVAL_MS)
    timersByIdRef.current.set(tipId, timer)
  }, [poll])

  useEffect(() => {
    if (!token || !wallet) return undefined

    let cancelled = false
    getTipActivity(wallet)
      .then((data) => {
        if (cancelled) return
        ;(data.tips || [])
          .filter((tip) => tip.status === 'pending')
          .forEach((tip) => trackTip(tip.id, { postId: tip.post_id, amount: Number(tip.amount) }))
      })
      .catch((err) => console.error('Pending tip recovery failed', err))

    return () => { cancelled = true }
  }, [token, wallet, trackTip])

  useEffect(() => {
    return () => {
      timersByIdRef.current.forEach((timer) => window.clearTimeout(timer))
      timersByIdRef.current.clear()
    }
  }, [])

  return { trackTip, statusById }
}