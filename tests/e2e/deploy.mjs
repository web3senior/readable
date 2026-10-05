// Deploys the registry and the name rules through deploy.html on the local fork. The page only
// deploys: launch.mjs sets the registry up on /admin, and admin.mjs points it at the rules.
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'
import { CHAIN_ID, DEPLOY_PAGE, OWNER, RPC, launch, shotsDir, walletShim } from './setup.mjs'

const browser = await launch()
const context = await browser.newContext({ viewport: { width: 1100, height: 1400 } })
await context.addInitScript(walletShim, { rpc: RPC, account: OWNER })
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))

// Picks a contract, waits for the address it would land at to be free, deploys it there. With
// `reuse`, a copy the factory already put there is taken as it is
async function deploy(artifact, argumentCount, { taken = [], reuse = false } = {}) {
  await page.selectOption('#artifactSelect', artifact)
  await page.waitForFunction((count) => document.querySelectorAll('#ctorFields input').length === count, argumentCount)
  await page.click('#loadArtifactBtn')
  await page.waitForFunction(
    ({ others, reuse }) => {
      const predicted = document.querySelector('#predictedAddr').textContent.trim()
      const status = document.querySelector('#targetStatus').textContent
      return predicted.startsWith('0x') && !others.includes(predicted) && (status.includes('empty') || (reuse && status.includes('already deployed')))
    },
    { others: taken, reuse }
  )
  const address = (await page.locator('#predictedAddr').innerText()).trim()
  if ((await page.locator('#targetStatus').innerText()).includes('already deployed')) return address

  await page.click('#deployBtn')
  await page.waitForFunction((deployed) => document.querySelector('#log').innerText.includes(`Code confirmed at ${deployed}`), address, {
    timeout: 30000,
  })
  return address
}

await page.goto(DEPLOY_PAGE, { waitUntil: 'networkidle' })
await page.click('#connectBtn')
await page.waitForFunction((chainId) => document.querySelector('#walletInfo').textContent.includes(`(${chainId})`), CHAIN_ID)

const registry = await deploy('Readable', 2)
// The name rules take no constructor argument and keep no state, so a copy of this build already
// at its address (on Robinhood Chain, which a fork inherits) is the same contract
const rules = await deploy('NameRules', 0, { taken: [registry], reuse: true })

await page.screenshot({ path: join(shotsDir, 'deploy.png'), fullPage: true })
writeFileSync(join(shotsDir, 'registry-address.txt'), registry)
writeFileSync(join(shotsDir, 'name-rules-address.txt'), rules)
console.log(`\nregistry: ${registry}`)
console.log(`name rules: ${rules}`)
console.log(errors.length ? `page errors: ${errors.join('; ')}` : 'no page errors')
await browser.close()
