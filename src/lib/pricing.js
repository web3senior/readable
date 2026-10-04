/**
 * The yearly price for a label of `length`, read the way the registry reads its curve: `prices[0]`
 * at `priceFrom` and below, each next entry one character longer, the last one for everything
 * longer. `priceFrom` is the namespace's shortest length when it was added, fixed from then on.
 */
export const priceForLength = (prices, priceFrom, length) => {
  if (!prices?.length) return null
  const index = Math.min(Math.max(length - priceFrom, 0), prices.length - 1)
  return prices[index]
}

/** Where a namespace's price curve starts: `priceFrom` onchain, the shortest length in a preview. */
export const priceFromOf = (namespace) => Number(namespace.priceFrom ?? namespace.minLength)
