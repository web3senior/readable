// Run after `forge build --build-info`: writes the deploy page's artifact, the app's ABI and the
// frozen standard-JSON input a later explorer verification needs.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
// The registry and the name rules it is pointed at, each deployed on its own
const CONTRACTS = ['Readable', 'NameRules']

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
  console.log(`wrote ${path}`)
}

const buildInfoDir = join(root, 'out/build-info')
let buildInfos
try {
  buildInfos = readdirSync(buildInfoDir).map((file) => readJson(join(buildInfoDir, file)))
} catch {
  throw new Error('No build info. Run `forge build --build-info` first.')
}

for (const name of CONTRACTS) {
  const artifact = readJson(join(root, `out/${name}.sol/${name}.json`))
  writeJson(join(root, `deploy/artifacts/${name}.json`), { contractName: name, abi: artifact.abi, bytecode: artifact.bytecode.object })
  writeJson(join(root, `../src/abis/${name}.json`), artifact.abi)

  const source = `src/${name}.sol`
  const info = buildInfos.find((entry) => entry.input?.sources?.[source])
  if (!info) throw new Error(`No build info covers ${source}`)
  writeJson(join(root, `deploy/verification/${name}.json`), info.input)
}
