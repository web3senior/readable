'use client'

import { useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { isAddressEqual } from 'viem'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import CopyButton from '@/components/ui/CopyButton'
import AddressAvatar from '@/components/ui/AddressAvatar'
import ReminderButton from '@/components/names/ReminderButton'
import PaymentDialog from '@/components/search/PaymentDialog'
import { addresses } from '@/config/addresses'
import { chainNameFor } from '@/config/chains'
import { records } from '@/config/records'
import { site } from '@/config/site'
import { formatDate, formatRelative, truncateAddress } from '@/lib/format'
import { namePath } from '@/lib/namespaces'
import { parseRecords, readField } from '@/lib/records'
import styles from './NameCard.module.scss'

const { path: NFT_PATH, art: NFT_ART } = site.nft
const listAnd = new Intl.ListFormat('en', { type: 'conjunction' })

/** One name as its holder sees it: its NFT, where it points and when it expires. Its page holds the changes. */
export default function NameCard({ name, account, currency, now }) {
  const paymentRef = useRef(null)
  const { namespace } = name
  const expired = name.expiresAt <= now
  const pointsHome = isAddressEqual(name.target, account)
  const document = parseRecords(name.stored)
  const filled = records.fields.filter((field) => readField(document, field.name)).length
  // The registry answers 0x for a chain with no address
  const chains = addresses.chains.filter(({ coin }) => name.addresses[coin.coinType] !== '0x')
  const page = namePath(namespace, name.label)

  return (
    <article className={styles.name}>
      {/* Drawn by the site, as a wallet sees it; an SVG gains nothing from the image optimizer */}
      <Image
        className={styles.name__nft}
        src={`${NFT_PATH}/${name.tokenId}/image`}
        width={NFT_ART.size}
        height={NFT_ART.size}
        alt={`The NFT of ${name.display}`}
        unoptimized
      />

      <header className={styles.name__header}>
        <div className={styles.name__badges}>
          <Badge tone={expired ? 'warning' : 'success'}>{expired ? 'Expired' : 'Active'}</Badge>
          {name.primary && <Badge tone="accent">Primary</Badge>}
        </div>
        <div className={styles.name__title}>
          <h3 className={styles.name__display} dir="auto">
            <Link className={styles.name__link} href={page}>
              {name.display}
            </Link>
          </h3>
          <CopyButton value={name.display} title="Copy name" />
        </div>
        <p className={styles.name__meta}>
          {namespace.title} · {chainNameFor(namespace.chainId)}
        </p>
      </header>

      <dl className={styles.name__panel}>
        <div className={styles.name__row}>
          <dt className={styles.name__term}>Points to</dt>
          <dd className={styles.name__value}>
            <span className={styles.name__identity}>
              <AddressAvatar address={name.target} size="sm" />
              <span title={name.target}>{pointsHome ? 'This wallet' : truncateAddress(name.target)}</span>
              <CopyButton value={name.target} title="Copy address" size={13} />
            </span>
          </dd>
        </div>
        <div className={styles.name__row}>
          <dt className={styles.name__term}>{expired ? 'Expired on' : 'Expires on'}</dt>
          <dd className={styles.name__value}>
            {formatDate(name.expiresAt)}
            <span className={styles.name__relative}> · {formatRelative(name.expiresAt, now)}</span>
          </dd>
        </div>
        <div className={styles.name__row}>
          <dt className={styles.name__term}>Records</dt>
          <dd className={styles.name__value}>{filled ? `${filled} of ${records.fields.length} filled` : 'None'}</dd>
        </div>
        <div className={styles.name__row}>
          <dt className={styles.name__term}>Other chains</dt>
          <dd className={styles.name__value}>{chains.length ? listAnd.format(chains.map((chain) => chain.label)) : 'None'}</dd>
        </div>
        {expired && <p className={styles.name__note}>Renew it to keep it. Until then it points nowhere and can’t be changed.</p>}
      </dl>

      <div className={styles.name__actions}>
        <Button variant="secondary" size="sm" href={page}>
          Manage
        </Button>
        <Button variant={expired ? 'primary' : 'secondary'} size="sm" onClick={() => paymentRef.current?.open()}>
          Renew
        </Button>
        <ReminderButton name={name.display} path={page} expiresAt={name.expiresAt} variant="ghost" />
      </div>

      <PaymentDialog
        ref={paymentRef}
        action="renew"
        candidate={{ namespace, label: name.label, name: name.display }}
        tokenId={name.tokenId}
        pricePerYear={name.pricePerYear}
        currency={currency}
      />
    </article>
  )
}
