import clsx from 'clsx'
import Link from 'next/link'
import CodeBlock from '@/components/docs/CodeBlock'
import DocsNav from '@/components/docs/DocsNav'
import { Extensions, GracePeriod, Prices } from '@/components/docs/LiveFacts'
import Spec from '@/components/docs/Spec'
import {
  addrSample,
  apiSample,
  checkDigitSample,
  contractSample,
  recordsDocument,
  recordsSample,
  resolveSample,
  reverseSample,
  sdkSample,
  setAddrsSample,
  tokenIdSample,
} from '@/components/docs/samples'
import { addresses } from '@/config/addresses'
import { explorerFor, home, viemExportFor } from '@/config/chains'
import { docGroups } from '@/config/docs'
import { ens } from '@/config/ens'
import { records } from '@/config/records'
import { registry } from '@/config/registry'
import { site } from '@/config/site'
import { launchNumbers as numbers, stage } from '@/lib/docs'
import { formatCount, formatYears } from '@/lib/format'
import { formatNumber } from '@/lib/query/numbers'
import styles from './page.module.scss'

const { docs } = site
const LOCALE = 'en'
// Shown where an address will be, until there is one
const NO_ADDRESS = '0x…'
// What a records field holds, as the docs list it. A handle is stored alone, read at its site
const fieldDescription = (field) => {
  if (field.type === 'handle') return `${field.label} handle, without the @. Read at ${field.profile}<handle>.`
  if (field.type === 'up') return `A LUKSO ${field.label}, by its address. The contact card shows the name and picture it publishes.`
  return field.hint ? `${field.label}. ${field.hint}` : field.label
}

// The chains a holder can add, by the coin type they are read with
const COIN_TYPE_ROWS = addresses.chains.map((chain) => [chain.label, <code key="c">{chain.coin.coinType}</code>])
// ENSIP-11: an EVM chain's coin type is its chain id with the top bit of 32 set
const EVM_COIN_TYPE = 0x80000000 + home.id

export const metadata = {
  title: docs.title,
  description: docs.description,
  alternates: { canonical: docs.path },
}

const LABELS = Object.fromEntries(docGroups.flatMap((group) => group.items.map((item) => [item.id, item.label])))

/** One section of the page. Its heading is its entry in the contents unless `title` says more. */
const Section = ({ id, title = LABELS[id], lead = false, children }) => (
  <section id={id} className={styles.doc__section}>
    {lead ? <h1 className={styles.doc__title}>{title}</h1> : <h2 className={styles.doc__heading}>{title}</h2>}
    {children}
  </section>
)

const Name = ({ children }) => <span className={styles.doc__name}>{children}</span>

const Address = ({ value }) => <code className={styles.doc__address}>{value}</code>

/**
 * The docs: one page with its contents beside it, not a route per topic. The page itself reads
 * nothing: it is written from the config and sent at once. What the registry decides (prices,
 * extensions, the grace period) is read by the browser afterwards, in
 * components/docs/LiveFacts.
 */
export default function DocsPage() {
  const written = (digits) => formatNumber(digits, numbers)
  const example = {
    short: written(docs.examples.short),
    number: written(docs.examples.number),
    long: written(docs.examples.long),
    // The long one in groups of four, as people often type a number
    spaced: written(docs.examples.long.replace(/\d{4}(?=\d)/g, '$& ')),
  }
  const checkDigitFrom = numbers.rules.checkDigit?.fromLength ?? 0
  const { currency } = numbers.preview

  const explorer = explorerFor(home.id)
  const sample = {
    registry: registry.address ?? NO_ADDRESS,
    chain: viemExportFor(home.id),
    currency,
    prefix: numbers.name,
    numbersId: String(docs.examples.namespaceId),
    number: example.long,
    label: docs.examples.long,
    checkDigitFrom,
    recordsKey: records.key,
    baseUrl: site.baseUrl,
  }

  const fee = home.nativeCurrency.symbol
  const reached = stage !== 'preview'

  return (
    <main className={styles.page}>
      <div className={styles.page__container}>
        <DocsNav />

        <article className={styles.doc}>
          <Section id="introduction" lead>
            <p className={styles.doc__lede}>
              Readable is a registry of numbers and usernames for wallets and AI agents. A number is digits after a prefix, such as{' '}
              <Name>{example.number}</Name>; a username is a word under an extension, written <code>word.extension</code>. This page
              calls both names. A name points at a wallet, its holder owns it as an NFT on {home.name}, and any app can look it up
              without asking anyone.
            </p>
            <p className={styles.doc__text}>
              A wallet address is 42 characters that nobody can say aloud or check by eye. A name is short enough to read out, type on a
              phone and recognise when it is wrong. A number carries no SIM, no country and no identity: it reaches a wallet and nothing
              else, so it is safe to publish.
            </p>
            {stage === 'preview' && (
              <p className={styles.doc__callout}>
                <strong>Readable has not launched yet.</strong> This site runs as a preview: you can search and see the launch prices,
                and nothing can be registered until the registry is deployed.
              </p>
            )}
            {stage === 'testnet' && (
              <p className={styles.doc__callout}>
                <strong>This is a rehearsal on {home.name}, a test network.</strong> Names registered here are for testing and carry no
                value.
              </p>
            )}
          </Section>

          <Section id="how-it-works">
            <p className={styles.doc__text}>
              The whole registry is one contract. Registering a name mints a token to your wallet, and everything about the name is read
              from that contract.
            </p>
            <ul className={styles.doc__list}>
              <li>
                <strong>One registry on one chain.</strong> Every name lives on {home.name}, so a name has exactly one holder.
              </li>
              <li>
                <strong>A name is an NFT.</strong> It sits in your wallet like any other token, and you can transfer or sell it.
              </li>
              <li>
                <strong>It is held for a paid term.</strong> You pay for one to {formatYears(registry.maxYears, LOCALE)} and renew before
                the term ends.
              </li>
              <li>
                <strong>It points at a wallet.</strong> At first that is the wallet holding it. The holder can point it at another.
              </li>
              <li>
                <strong>It carries records.</strong> A display name, an avatar, a website, where an AI agent answers, and addresses on{' '}
                <a href="#other-chains">chains that aren’t EVM</a>.
              </li>
              <li>
                <strong>Only its holder changes it,</strong> and an editor it names. The registry has no function that takes a name from
                its holder, for the registry’s owner either: see <a href="#owner">what the owner can do</a>.
              </li>
            </ul>
          </Section>

          <Section id="numbers">
            <p className={styles.doc__text}>
              A number is written <Name>{example.long}</Name>: the prefix <code>{numbers.prefix}</code>, then the digits, unbroken. No
              country’s phone code starts with 0, so a Readable number can never be mistaken for a phone number.
            </p>
            <Spec
              rows={[
                ['Length', `${numbers.rules.minLength} to ${numbers.rules.maxLength} digits`],
                ['Check digit', checkDigitFrom ? `The last digit, in numbers of ${checkDigitFrom} digits and longer` : 'None'],
                ['Stored as', <code key="stored">{docs.examples.long}</code>],
                ['Shortest', example.short],
              ]}
            />
            <ul className={styles.doc__list}>
              <li>
                <strong>Spaces and dashes don’t count.</strong> <code>{example.spaced}</code>,{' '}
                <code>{example.spaced.replaceAll(' ', '-')}</code> and <code>{docs.examples.long}</code> are all{' '}
                <Name>{example.long}</Name>. The registry stores the digits alone.
              </li>
              <li>
                <strong>No number starts with 0.</strong> A zero in front would add nothing to the check digit and make a twin of
                the number after it, so <code>0{docs.examples.number}</code> is read as <Name>{example.number}</Name>, its prefix
                written without the plus.
              </li>
              <li>
                <strong>Short numbers are the rare ones.</strong> Only {formatCount(10 ** numbers.rules.minLength, LOCALE)} numbers have{' '}
                {numbers.rules.minLength} digits, and they are priced to match. Long numbers cost very little.
              </li>
              {checkDigitFrom > 0 && (
                <li>
                  <strong>Long numbers check themselves.</strong> From {checkDigitFrom} digits, the last digit is worked out from the
                  others, so one mistyped digit fails instead of reaching a stranger. See <a href="#check-digit">the check digit</a>.
                </li>
              )}
            </ul>
          </Section>

          <Section id="usernames" title="Usernames and extensions">
            <p className={styles.doc__text}>
              A username is a word under an extension, written <code>word.extension</code>. The registry’s owner adds each extension
              onchain, and this site offers whichever ones the registry holds.
            </p>
            <Extensions />
            <ul className={styles.doc__list}>
              <li>
                <strong>Letters of one script.</strong> Latin, Greek, Cyrillic, Armenian, Hebrew, Arabic and Georgian letters, and
                Chinese, Japanese and Korean characters, with digits and hyphens. A hyphen can’t start or end a name.
              </li>
              <li>
                <strong>No look-alikes.</strong> A Greek, Cyrillic or Armenian name needs a letter that can’t pass for a Latin one, so
                nobody can register a copy of a Latin name drawn in other letters.
              </li>
              <li>
                <strong>Lowercase.</strong> <code>Alice</code> and <code>alice</code> are the same name.
              </li>
              <li>
                <strong>No emoji.</strong> A name with an emoji in it is refused under every extension.
              </li>
            </ul>
            <p className={styles.doc__text}>
              These rules live in a contract of their own, which the registry’s owner can replace to take more scripts. New rules apply
              to new registrations: a name already held keeps its label, and is renewed by the length it was registered with.
            </p>
            <p className={styles.doc__note}>
              <strong>An extension belongs to this registry alone.</strong> If it is spelled like the ending of another naming system,
              the two are unrelated, and the same name can belong to different people in each.
            </p>
          </Section>

          <Section id="get-a-name">
            <ol className={styles.doc__steps}>
              <li>
                <strong>Search.</strong> Type the number or username you want on <Link href="/">the home page</Link>. Its card says whether it is
                available, taken or reserved, and if it can’t be a name, why.
              </li>
              <li>
                <strong>Choose the years.</strong> Connect a wallet and pick one to {formatYears(registry.maxYears, LOCALE)}. The card
                shows the total.
              </li>
              <li>
                <strong>Pay in {currency}.</strong> The name is minted to your wallet in the same transaction, and points at your
                wallet from that moment.
              </li>
            </ol>
            <p className={styles.doc__text}>
              It is one transaction from your wallet, which sends the exact price with it. The network fee on {home.name} is a small
              part of a cent of {fee} on top.
            </p>
            <p className={styles.doc__text}>
              <strong>No {currency} yet?</strong> Where Coinbase’s onramp serves the chain, the payment dialog offers to buy it by card,
              delivered to the wallet you are paying from.
            </p>
          </Section>

          <Section id="prices">
            <p className={styles.doc__text}>
              A name is priced by the year and by its length: the shorter it is, the more it costs. The registry holds the price list,
              and its owner can change it. A change applies to registrations and renewals from then on, never to years already paid for.
            </p>
            <Prices />
          </Section>

          <Section id="manage">
            <p className={styles.doc__text}>
              <Link href={site.names.path}>{site.names.title}</Link> lists the names your wallet holds. The wallet holding a name, or the
              editor it names, signs each change, and while the site’s relayer is running it pays no fee: the wallet signs a message
              instead of a transaction and the relayer sends it. A smart wallet’s change goes to the site’s paymaster instead, when there is one. Renewing is a
              payment, so it is a transaction of its own.
            </p>
            <Spec
              rows={[
                ['Point to a wallet', 'Where the name delivers. Hold the name in a wallet you keep safe and point it at the one you use.'],
                ['Make primary', 'The one name apps show in place of your address. A wallet has one primary name at a time.'],
                ['Records', 'What the name says about you or your agent, saved together in one change.'],
                ['Editor', 'Another wallet, such as the agent the name stands for, that can point it, fill in its records and set its other chains. It can’t move the name, and it goes when the name changes hands.'],
                ['Renew', 'Adds years to the term.'],
                ['Remind me to renew', 'A calendar file with a reminder a month and a week before the name expires. The site keeps no address and sends nothing.'],
              ]}
            />
            <p className={styles.doc__text}>
              <strong>Watching a name.</strong> Someone else’s name can be watched from its card. {site.names.title} lists the names you
              watch, in this browser only, with the day each returns to the public unless its holder renews it, and a calendar file for
              that day.
            </p>
          </Section>

          <Section id="pay">
            <p className={styles.doc__text}>
              Anyone can send {currency} to a name from its page or its search card: <Name>{example.number}</Name> instead of a 0x…
              address. The wallet the name points to is looked up again the moment you sign, so a name that changed hands since the page
              loaded pays its new holder, and a name that reaches nobody is refused.
            </p>
          </Section>

          <Section id="share">
            <p className={styles.doc__text}>
              Every name has a page of its own, <code>{site.names.path}/{example.number.replaceAll(' ', '-')}</code>, with its contact card,
              a Pay button and a code to scan. A link to it shows the name in its preview wherever it is pasted.
            </p>
            <p className={styles.doc__text}>A badge puts the name on any site or README, linked to its page:</p>
            <CodeBlock language="Markdown" code={`[![${example.number} on ${site.name}](${site.baseUrl}${site.badge.path}/${example.number.replaceAll(' ', '-')})](${site.baseUrl}${site.names.path}/${example.number.replaceAll(' ', '-')})`} />
            <p className={styles.doc__text}>
              <strong>Proven accounts.</strong> Records say what their holder writes. To prove an X or GitHub account is yours, the
              wallet holding the name signs a statement, the account posts it, and the post’s link goes into the records. The site
              checks that the post is the account’s and the signature the current holder’s, and shows a check beside the account. A
              transfer clears the records, proofs included.
            </p>
          </Section>

          <Section id="renewal">
            <p className={styles.doc__text}>
              A name is yours until its term ends. Renewing adds years to the end of the term, so renewing early loses nothing. Anyone
              can pay for a renewal, not only the holder.
            </p>
            <Spec
              rows={[
                ['During the term', 'The name resolves, and its holder can point it, fill it in and transfer it.'],
                [
                  <span key="grace">
                    For <GracePeriod /> after
                  </span>,
                  'The grace period. The name reaches nobody and can’t be changed or transferred, but it is still held: it can be renewed, and nobody else can register it.',
                ],
                ['After that', 'Anyone can register it. It starts clean, pointing at its new holder, with no records.'],
              ]}
            />
            <p className={styles.doc__callout}>
              <strong>A name stops delivering the moment its term ends,</strong> not at the end of the grace period. Renew before the
              date on the name’s card.
            </p>
          </Section>

          <Section id="transfers">
            <p className={styles.doc__text}>
              A name moves like any NFT: send it from your wallet, or sell it on a marketplace. The registry resets it as it moves, so a
              name that changes hands never keeps delivering to whoever held it before.
            </p>
            <ul className={styles.doc__list}>
              <li>
                <strong>It points at its new holder.</strong> Wherever the previous holder had pointed it is forgotten.
              </li>
              <li>
                <strong>Its records are cleared.</strong> The previous holder’s avatar, website and agent payment address are gone.
              </li>
              <li>
                <strong>Its editor is removed.</strong> Whoever the previous holder let edit the name no longer can.
              </li>
              <li>
                <strong>It stops being the sender’s primary name.</strong> The new holder makes it theirs if they want it to be.
              </li>
              <li>
                <strong>The term stays.</strong> The new holder gets the years that were left. A name whose term has ended can’t be
                transferred.
              </li>
            </ul>
          </Section>

          <Section id="registry">
            <p className={styles.doc__text}>
              Everything below reads one contract. It needs no key, no account and no permission: any wallet, app or agent can call it.
            </p>
            <Spec
              rows={[
                ['Network', `${home.name} (chain id ${home.id})`],
                [
                  'Registry',
                  registry.address ? (
                    explorer ? (
                      <a key="registry" href={`${explorer}/address/${registry.address}`} target="_blank" rel="noopener noreferrer">
                        <Address value={registry.address} />
                      </a>
                    ) : (
                      <Address key="registry" value={registry.address} />
                    )
                  ) : (
                    'Published when the registry is deployed'
                  ),
                ],
                ['Token', `${registry.token.name} (${registry.token.symbol}), ERC-721`],
                ['Paid in', `${currency}, the price sent with the transaction`],
              ]}
            />
            <Spec
              caption="What to read"
              rows={[
                [<code key="f">resolve(tokenId)</code>, 'The wallet a name delivers to. The zero address when it reaches nobody.'],
                [<code key="f">lookup(namespaceId, label)</code>, 'Everything about one name in a single read: whether it is valid, available, who holds it, until when, and its price.'],
                [<code key="f">tokenIdOf(namespaceId, label)</code>, 'The token id of a name.'],
                [<code key="f">primaryNameOf(account)</code>, 'The name a wallet shows in place of its address.'],
                [<code key="f">namesOf(account)</code>, 'The token ids a wallet holds.'],
                [<code key="f">recordOf(tokenId)</code>, 'A name’s label, where it points, and when its term began and ends. Where it points outlives the term: send with resolve.'],
                [<code key="f">text(tokenId, key)</code>, 'One stored text of a name.'],
                [<code key="f">addr(tokenId, coinType)</code>, 'Where a name receives on another chain, as ENS keeps it. An EVM chain answers with what resolve answers; any other is empty when none is set.'],
                [<code key="f">editorOf(tokenId)</code>, 'The wallet its holder lets change the name, or the zero address.'],
                [<code key="f">generationOf(tokenId)</code>, 'How many times the name has had a new holder, by registration or transfer. Key what belongs to one holder by the token id and this.'],
                [<code key="f">getNamespaces()</code>, 'The number ranges and extensions, with their rules.'],
                [<code key="f">getPrices(namespaceId)</code>, 'A namespace’s yearly prices, from the length in its priceFrom up.'],
              ]}
            />
          </Section>

          <Section id="sdk">
            <p className={styles.doc__text}>
              The quickest way to resolve a name is <code>readable-sdk</code>, a small library on{' '}
              <a href="https://viem.sh" target="_blank" rel="noopener noreferrer">
                viem
              </a>
              , or the API this site serves, built on it. Both read the registry and need no key. A number can be written any way
              people write it: <Name>{example.long}</Name>, <code>{example.spaced}</code>, <code>{docs.examples.long}</code> and{' '}
              <code>+{numbers.name}-{docs.examples.long}</code> are the same.
            </p>
            <CodeBlock language="Shell" code="npm install readable-sdk viem" />
            <CodeBlock language="JavaScript" code={sdkSample(sample)} />
            <Spec
              caption="What it reads"
              rows={[
                [<code key="f">resolve(name)</code>, 'The wallet the name reaches: what most EVM chains use.'],
                [<code key="f">getAddress(name, coin)</code>, 'Its address on another chain: btc, sol, eth, or a coin type.'],
                [<code key="f">getRecords(name)</code>, 'Its records document.'],
                [<code key="f">getName(address)</code>, 'The primary name a wallet chose.'],
                [<code key="f">getProfile(name)</code>, 'The name, its holder, wallet, addresses, records and expiry, in one read.'],
              ]}
            />
            <p className={styles.doc__text}>
              Each answers null for a name that reaches nobody: never registered, expired, or one that can’t exist. The reads of one
              call go out together, as a single multicall.
            </p>
            <p className={styles.doc__text}>From any other language, ask the API. It answers JSON to any origin.</p>
            <CodeBlock language="Shell" code={apiSample(sample)} />
            <Spec
              rows={[
                [<code key="p">{`${site.api.resolvePath}/<name>`}</code>, 'What getProfile answers. 404 when the name reaches nobody.'],
                [<code key="p">{`${site.api.reversePath}/<address>`}</code>, 'The wallet’s primary name, or null.'],
                [<code key="p">{`${site.verify.path}/<name>`}</code>, 'Which accounts in the name’s records are proven to be its holder’s.'],
                [<code key="p">{site.agents.api}</code>, 'Every live name whose records reach an AI agent.'],
                [<code key="p">{`${site.badge.path}/<name>`}</code>, 'The name’s badge, an SVG image.'],
              ]}
            />
            <p className={styles.doc__note}>
              <strong>Resolve when you send.</strong> The API’s answers are kept for {site.api.cacheSeconds} seconds, and a name can
              change hands in that time. Before money moves, use the SDK, which reads the registry at each call.
            </p>
          </Section>

          <Section id="agents">
            <p className={styles.doc__text}>
              A name can reach an AI agent: its records name the endpoint where the agent answers, its ERC-8004 id and where it is paid.{' '}
              <Link href={site.agents.path}>{site.agents.title}</Link> lists every name that does.
            </p>
            <p className={styles.doc__text}>
              Agents that speak MCP can use names without any code. Add this site’s MCP server, which needs no key:
            </p>
            <CodeBlock language="JSON" code={JSON.stringify({ mcpServers: { [site.mcp.name]: { url: `${site.baseUrl}${site.mcp.path}` } } }, null, 2)} />
            <Spec
              caption="Its tools"
              rows={[
                [<code key="t">resolve_name</code>, 'The wallet, addresses, holder, expiry and records of a name.'],
                [<code key="t">lookup_address</code>, 'The primary name a wallet chose.'],
                [<code key="t">check_name</code>, 'Whether a name is free, what it costs, or who holds it.'],
                [<code key="t">dial_agent</code>, 'The endpoint, ERC-8004 id and payment address of the agent behind a name.'],
                [<code key="t">list_agents</code>, 'Every agent with a name.'],
                [<code key="t">payment_details</code>, 'The chain, token and recipient to pay a name now.'],
              ]}
            />
            <p className={styles.doc__text}>
              In code, <code>getAgent(name)</code> of the SDK answers the same as <code>dial_agent</code>.
            </p>
            <p className={styles.doc__text}>
              <strong>Names for the agents your app runs.</strong> <code>registerFor(namespaceId, label, to, years)</code> buys a name
              straight into another wallet, the agent’s or its user’s, at the price <code>register</code> charges. Its holder can then
              make the agent its editor with <code>setEditor(tokenId, agent)</code>, so the agent keeps its own endpoint and payment
              address up to date and can never sell the name. Keep a rating or a reputation by the token id and{' '}
              <code>generationOf(tokenId)</code>, so it never passes to whoever holds the name next.
            </p>
          </Section>

          <Section id={site.integrations.section}>
            <p className={styles.doc__text}>
              Where a name works outside this site. Readable is new, and few apps read its names yet: building a registry is the easy
              part, and a name is only as useful as the apps that read it. Those marked {docs.stages.next} are built and wait for their
              launch, those marked {docs.stages.planned} are not built yet, and the <a href="#roadmap">roadmap</a> says what comes
              after. Any app can read names today through the <a href="#sdk">SDK and API</a>, without asking anyone.
            </p>
            <Spec
              rows={site.integrations.items.map((item) => [
                item.stage ? `${item.name} · ${docs.stages[item.stage]}` : item.name,
                item.about.replaceAll('{number}', example.number).replaceAll('{ens}', `${docs.examples.number}.${ens.parent}`),
              ])}
            />
          </Section>

          <Section id="resolve">
            <p className={styles.doc__text}>
              Resolving is three steps: find the namespace, reduce what was typed to the label the registry stores, and ask where it
              points. This is <Name>{example.long}</Name> with <a href="https://viem.sh" target="_blank" rel="noopener noreferrer">viem</a>.
            </p>
            <CodeBlock language="JavaScript" code={resolveSample(sample)} />
            <p className={styles.doc__text}>
              For a username, the label is the word before the dot, in lowercase and in Unicode’s composed form:{' '}
              <code>word.normalize(&apos;NFC&apos;).toLowerCase()</code>. The namespace is the one of kind 0 named by the extension.
            </p>
            <p className={styles.doc__note}>
              <strong>Deliver with <code>resolve</code>, not with <code>lookup</code>.</strong> <code>lookup</code> answers what a
              search card shows, and keeps naming the holder through the grace period. <code>resolve</code> stops the moment the term
              ends.
            </p>
          </Section>

          <Section id="from-a-contract">
            <p className={styles.doc__text}>
              A contract on {home.name} resolves a number in one line. This one pays {currency} to whoever a number reaches, and
              refuses when it reaches nobody.
            </p>
            <CodeBlock language="Solidity" code={contractSample(sample)} />
            <p className={styles.doc__text}>
              <code>tokenIdOf</code> reverts for a namespace that doesn’t exist and for a label with a character its namespace never
              allows. A number that is well formed and was never registered resolves to the zero address.
            </p>
          </Section>

          <Section id="reverse">
            <p className={styles.doc__text}>
              To show a name where you would show an address, read the wallet’s primary name. The registry answers only with a name the
              wallet holds now and whose term has not ended.
            </p>
            <CodeBlock language="JavaScript" code={reverseSample()} />
            <ul className={styles.doc__list}>
              <li>
                <strong>The name arrives ready to show.</strong> The registry writes a number as this site does,{' '}
                <code>{example.long}</code>, and a username as <code>word.extension</code>.
              </li>
              <li>
                <strong>Holding is not pointing.</strong> A primary name says who the wallet is. If you need the name to deliver to
                that same wallet, compare <code>resolve(tokenId)</code> with it.
              </li>
              <li>
                <strong>
                  <code>namesOf</code> includes names whose term has ended.
                </strong>{' '}
                They stay in the wallet until someone else registers them. Check <code>expiresAt</code> in <code>recordOf</code>.
              </li>
            </ul>
          </Section>

          <Section id="records">
            <p className={styles.doc__text}>
              A name’s records are one JSON document, stored under the text key <code>{records.key}</code>. One document means a holder
              saves everything in a single transaction and an app reads it in a single call.
            </p>
            <CodeBlock language="JSON" code={recordsDocument} />
            <Spec
              rows={records.fields.map((field) => [
                <code key={field.name}>{field.name}</code>,
                fieldDescription(field),
              ])}
            />
            <CodeBlock language="JavaScript" code={recordsSample(sample)} />
            <ul className={styles.doc__list}>
              <li>
                <strong>Every field is optional,</strong> and a name with no records answers with an empty text.
              </li>
              <li>
                <strong>Your app can keep its own keys.</strong> This site leaves the keys it doesn’t know as they are when a holder
                saves.
              </li>
              <li>
                <strong>Records are what the holder says.</strong> Nothing checks them. Treat a link or a payment address as a claim
                by whoever holds the name.
              </li>
              <li>
                <strong>Where a name points is not a record.</strong> It is what <code>resolve</code> answers, and the holder sets it
                with <code>setTarget</code>.
              </li>
              <li>
                <strong>Addresses on other chains are not records either.</strong> They have a call of their own: see{' '}
                <a href="#other-chains">other chains</a>.
              </li>
            </ul>
          </Section>

          <Section id="other-chains">
            <p className={styles.doc__text}>
              A name can also carry an address on chains that aren’t EVM, kept as ENS keeps them (ENSIP-9).{' '}
              <code>addr(tokenId, coinType)</code> answers one, in the chain’s own binary form, and empty bytes when the holder set none.{' '}
              {home.name} and most other EVM chains use what <code>resolve</code> answers, and <code>addr</code> gives the same for
              any EVM chain’s coin type.
            </p>
            <Spec caption="Coin types the site offers" rows={COIN_TYPE_ROWS} />
            <p className={styles.doc__text}>
              A coin type is a chain’s number in{' '}
              <a href="https://github.com/satoshilabs/slips/blob/master/slip-0044.md" target="_blank" rel="noopener noreferrer">
                SLIP-44
              </a>
              , the list wallets use to tell chains apart in their key paths (<code>m/44&apos;/0&apos;/…</code> for Bitcoin). The
              registry takes any coin type but an EVM chain’s, so another chain is a change to an app, not to the contract.
            </p>
            <p className={styles.doc__callout}>
              <strong>A coin type is not a chain id.</strong> A chain id tells EVM networks apart so a transaction signed for one
              can’t run on another; a coin type names a chain’s address format. Ethereum’s chain id is 1 and its coin type 60;
              Bitcoin and Solana have no chain id. ENS gives an EVM chain the coin type <code>0x80000000 | chainId</code> (ENSIP-11),
              so {home.name}, chain {home.id}, is <code>{EVM_COIN_TYPE}</code>. Readable stores nothing under those: asked for one
              of them, or for 60, <code>addr</code> answers with the address <code>resolve</code> gives, and <code>setAddrs</code>{' '}
              refuses them.
            </p>
            <p className={styles.doc__text}>
              Turn the bytes into text with{' '}
              <a href="https://github.com/ensdomains/address-encoder" target="_blank" rel="noopener noreferrer">
                @ensdomains/address-encoder
              </a>
              , whose coder for each chain knows its coin type.
            </p>
            <CodeBlock language="JavaScript" code={addrSample()} />
            <p className={styles.doc__text}>
              The holder sets them with <code>setAddrs</code>: a token id and a list of coin types with their bytes. The registry
              stores the bytes as they come and never reads them, so check an address before sending it.
            </p>
            <CodeBlock language="JavaScript" code={setAddrsSample()} />
            <ul className={styles.doc__list}>
              <li>
                <strong>They belong to one holding, as records do.</strong> A transfer or a new registration starts with none, and an
                expired name answers with none.
              </li>
              <li>
                <strong>They are what the holder says.</strong> Nothing proves the holder controls the address.
              </li>
            </ul>
          </Section>

          <Section id="token-ids">
            <p className={styles.doc__text}>
              A name’s token id is the hash of its namespace id and its label, so an app can work it out without a call.
            </p>
            <CodeBlock language="JavaScript" code={tokenIdSample(sample)} />
            <p className={styles.doc__text}>
              What a wallet or a marketplace shows for the token comes from the link the registry gives as <code>tokenURI</code>. The
              registry’s owner sets where that link leads, and this site serves it: the name as its title, and a picture of the name.
            </p>
            <Spec
              rows={[
                [<code key="p">{`${site.nft.path}/<id>`}</code>, 'The token’s title, description, picture and traits, as JSON.'],
                [<code key="p">{`${site.nft.path}/<id>/image`}</code>, 'The picture, as SVG.'],
              ]}
            />
          </Section>

          <Section id="check-digit">
            {checkDigitFrom > 0 ? (
              <>
                <p className={styles.doc__text}>
                  Numbers of {checkDigitFrom} digits and longer end in a check digit, worked out from the digits before it by the Luhn
                  formula that payment cards use. You choose all the digits but the last.
                </p>
                <p className={styles.doc__text}>
                  Of the ten numbers that differ only in their last digit, one is valid. A single mistyped digit, and most swaps of
                  two neighbours, give a number that can’t exist, so the mistake is caught before anything is sent.
                </p>
                <CodeBlock language="JavaScript" code={checkDigitSample(sample)} />
                <p className={styles.doc__text}>
                  The registry runs the same check: <code>lookup</code> answers a wrong check digit with the validity{' '}
                  <code>InvalidCheckDigit</code> (6), and <code>register</code> refuses it. Check in your app first, and the reader learns about the typo without a call.
                </p>
              </>
            ) : (
              <p className={styles.doc__text}>The registry’s numbers carry no check digit.</p>
            )}
          </Section>

          <Section id="events">
            <p className={styles.doc__text}>An indexer follows these.</p>
            <Spec
              rows={[
                [<code key="e">NameRegistered</code>, 'A name was registered, by payment or as a grant from the owner.'],
                [<code key="e">NameRenewed</code>, 'A term was extended.'],
                [<code key="e">TargetChanged</code>, 'A name points at another wallet. A transfer emits it too.'],
                [<code key="e">PrimaryNameChanged</code>, 'A wallet chose its primary name, or lost it. Token id 0 means none.'],
                [<code key="e">TextChanged</code>, 'A stored text was written.'],
                [<code key="e">AddressChanged</code>, 'An address on another chain was set or removed. An empty value means none.'],
                [<code key="e">EditorChanged</code>, 'A holder named an editor, or removed it. The zero address means none.'],
                [<code key="e">Transfer</code>, 'The ERC-721 event: a name changed hands.'],
                [<code key="e">NamespaceAdded, PricesUpdated</code>, 'What the registry sells, and for how much.'],
              ]}
            />
            <p className={styles.doc__callout}>
              <strong>Treat a transfer and a new registration as a reset.</strong> Both clear the name’s stored texts, addresses and
              editor without a <code>TextChanged</code>, <code>AddressChanged</code> or <code>EditorChanged</code> for each. An index
              that keeps the old values would show the previous holder’s records.
            </p>
          </Section>

          <Section id="in-your-app">
            <p className={styles.doc__text}>A name can change hands or run out. Five habits keep that from hurting anyone.</p>
            <ul className={styles.doc__list}>
              <li>
                <strong>Resolve when you use it.</strong> Ask the registry at the moment of sending, not once at sign-up.
              </li>
              <li>
                <strong>Remember who it was.</strong> When someone saves a contact, keep the number together with the address it
                reached, and warn them if the two no longer match.
              </li>
              <li>
                <strong>Nobody means stop.</strong> The zero address is never somewhere to send.
              </li>
              <li>
                <strong>Check the digits first.</strong> Validate a number’s length and check digit before asking the chain.
              </li>
              <li>
                <strong>Write it as one number.</strong> The prefix, a space, then the digits with no spaces between them:{' '}
                <Name>{example.long}</Name>.
              </li>
            </ul>
          </Section>

          <Section id="owner">
            <p className={styles.doc__text}>
              The registry has an owner: one wallet that decides what is sold. What it can do ends where a registered name begins.
            </p>
            <Spec
              caption="The owner can"
              rows={[
                ['Add extensions', 'And number ranges, each with its rules.'],
                ['Replace the name rules', 'Which characters a username can hold, for registrations from then on. A name already held keeps its label.'],
                ['Change prices', 'For registrations and renewals from then on. A renewal costs the price of its day, so a price its holder won’t pay ends the name with its term.'],
                ['Reserve names', 'Keep names nobody holds out of public registration.'],
                ['Grant a name', 'Register an available name for someone without payment.'],
                ['Pause', 'Stop new registrations in one namespace, or in all. Renewals never stop, and names already held keep working.'],
                ['Change settings', `The grace period, where payments go, the forwarder, and where the NFT’s title and picture come from.`],
              ]}
            />
            <Spec
              caption="The owner can’t"
              rows={[
                ['Take a name', 'The registry has no function that moves or ends a name someone holds, and no forwarder can move one.'],
                ['Change a name', 'Where it points and its records are changed by its holder and the editor it names, its primary status by its holder alone, with the one exception below.'],
                ['Shorten a term', 'Years paid for are kept.'],
              ]}
            />
            <p className={styles.doc__note}>
              <strong>The forwarder.</strong> A holder’s or an editor’s change to a name without {fee} (where it points, its primary
              status, its records, its other chains) reaches the registry through one forwarder contract, which the registry trusts to
              say who signed it. It is believed for those changes alone: purchases, transfers, approvals, the choice of an editor and
              every owner function answer to the wallet that calls them, so no forwarder can move a name, name an editor or act as the
              owner. The owner can replace the forwarder, and
              one it wrote could change any live name’s target, records and addresses. That is the setting to watch: every change is
              announced by <code>TrustedForwarderUpdated</code>.
            </p>
          </Section>

          <Section id="roadmap">
            <div className={styles.roadmap}>
              {[
                {
                  stage,
                  reached,
                  title: 'Numbers',
                  body: `Numbers from ${numbers.rules.minLength} digits, with search, registration, renewal, records and transfers.`,
                },
                {
                  stage: 'next',
                  title: 'Usernames',
                  body: 'Words under extensions, written word.extension, which the registry’s owner adds onchain.',
                },
                {
                  stage,
                  reached,
                  title: 'Add a contact by number',
                  body: 'In Tunnel, the encrypted chat: type a number where you would paste an address, and be warned when the number changes hands.',
                },
                {
                  stage: 'planned',
                  title: 'Bill and pay a number',
                  body: 'In PayPost: send an invoice to a number, and pay one.',
                },
                {
                  stage,
                  reached,
                  title: 'Dial an agent',
                  body: 'A number that reaches an AI agent, with its endpoint and payment address in the number’s records, found through the MCP server and the agents directory.',
                },
              ].map((item) => (
                <div key={item.title} className={styles.roadmap__item}>
                  <span className={clsx(styles.roadmap__stage, item.reached && styles['roadmap__stage--reached'])}>
                    {docs.stages[item.stage]}
                  </span>
                  <p className={styles.roadmap__body}>
                    <strong>{item.title}</strong>
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        </article>
      </div>
    </main>
  )
}
