import { decodeErrorResult } from 'viem'

// The bytes a contract reverted with, wherever the node's answer put them
const revertData = (error) => {
  const holder = error?.walk?.((cause) => typeof cause?.data === 'string' || typeof cause?.data?.data === 'string')
  const data = holder?.data
  return typeof data === 'string' ? data : (data?.data ?? null)
}

/**
 * Why a call reverted, in the contract's own words: the name of its custom error or the text it
 * reverted with. Null when the refusal carried no reason.
 */
export const revertReason = (error, abi) => {
  const data = revertData(error)
  if (!data || data === '0x') return null
  try {
    const { errorName, args } = decodeErrorResult({ abi, data })
    return errorName === 'Error' ? String(args[0]) : errorName
  } catch {
    return null
  }
}
