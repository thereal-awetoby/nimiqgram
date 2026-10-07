export function normalizeWalletAddress(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, '').toLowerCase()
}

export function isSameWalletAddress(first, second) {
  const normalizedFirst = normalizeWalletAddress(first)
  return Boolean(normalizedFirst && normalizedFirst === normalizeWalletAddress(second))
}
