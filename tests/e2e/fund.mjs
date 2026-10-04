// Gives the buyer 10,000 ETH on the local fork, what an Anvil account starts with, so a run
// that spent it or emptied it starts again from there.
import { parseEther } from 'viem'
import { BUYER, ethOf, rpc } from './setup.mjs'

const AMOUNT = parseEther('10000')
await rpc('anvil_setBalance', [BUYER, `0x${AMOUNT.toString(16)}`])

const balance = await ethOf(BUYER)
if (balance !== AMOUNT) throw new Error(`the buyer holds ${balance} wei`)
console.log(`buyer holds ${balance / 10n ** 18n} ETH`)
