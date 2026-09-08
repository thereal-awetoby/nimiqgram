import { useEffect, useState } from 'react'
import initCore, { Transaction } from '@nimiq/core/web'
import { useAuth } from '../context/AuthContext'
import { sendTip } from '../lib/api'

// ...(all the normalize/decode/getTransactionHash/getTransactionSender helpers unchanged)...

function TipModal({ post, onClose, onSuccess, onPending, verificationStatus }) {
  const { token, user } = useAuth()
  const [amount, setAmount] = useState('1')
  const [status, setStatus] = useState('idle') // idle | sending | pending | success | error
  const [error, setError] = useState(null)

  // Reflects the parent's independent polling (usePendingTips) back into the
  // modal's own UI, in case the user keeps it open. If they close it, this
  // component unmounts and simply stops listening — the parent keeps polling.
  useEffect(() => {
    if (verificationStatus === 'verified' && status === 'pending') {
      setStatus('success')
    }
  }, [verificationStatus, status])

  async function handleSendTip() {
    setStatus('sending')
    setError(null)

    try {
      const { init } = await import('@nimiq/mini-app-sdk')
      const nimiq = await init()
      const serializedTransaction = await nimiq.sendBasicTransaction({
        recipient: post.author?.wallet,
        value: Math.round(Number(amount) * 100000),
      })
      if (serializedTransaction?.error) throw new Error(serializedTransaction.error.message || 'The wallet rejected the tip.')

      await initCore()
      const txHash = getTransactionHash(serializedTransaction)

      const actualSender = normalizeWalletAddress(getTransactionSender(serializedTransaction))
      const loggedInWallet = normalizeWalletAddress(user?.wallet)
      if (actualSender && loggedInWallet && actualSender !== loggedInWallet) {
        throw new Error('This tip was sent from a different Nimiq Pay account than the one you\'re logged in with. Switch to your logged-in account in Nimiq Pay and try again.')
      }

      let result
      try {
        result = await sendTip(token, {
          toWallet: post.author?.wallet,
          postId: post.id,
          amount: Number(amount),
          txHash,
        })
      } catch (err) {
        throw new Error(err.message)
      }

      if (result?.status === 'verified') {
        setStatus('success')
        onSuccess?.(result)
      } else {
        setStatus('pending')
        onPending?.(result)
      }
    } catch (err) {
      console.error(err)
      setError(err.message)
      setStatus('error')
    }
  }

  // ...render unchanged...
}

export default TipModal