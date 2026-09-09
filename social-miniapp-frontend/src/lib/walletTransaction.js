let activeTransaction = null

export async function sendWalletTransaction(nimiq, transaction) {
  if (activeTransaction) {
    throw new Error('A wallet transaction is already in progress. Confirm or cancel it in Nimiq Pay before starting another one.')
  }

  const currentTransaction = Promise.resolve().then(() => nimiq.sendBasicTransaction(transaction))
  activeTransaction = currentTransaction

  try {
    return await currentTransaction
  } finally {
    if (activeTransaction === currentTransaction) activeTransaction = null
  }
}