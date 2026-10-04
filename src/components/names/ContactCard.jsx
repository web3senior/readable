'use client'

import { useId, useState } from 'react'
import Image from 'next/image'
import { isAddress } from 'viem'
import { SealCheckIcon } from '@phosphor-icons/react'
import AddressAvatar from '@/components/ui/AddressAvatar'
import CopyButton from '@/components/ui/CopyButton'
import EmptyState from '@/components/ui/EmptyState'
import { FALLBACK_ICON, RECORD_ICONS } from '@/components/names/recordIcons'
import { addresses } from '@/config/addresses'
import { records } from '@/config/records'
import { site } from '@/config/site'
import useUniversalProfile from '@/hooks/useUniversalProfile'
import useVerification from '@/hooks/useVerification'
import { addressText } from '@/lib/addresses'
import { formatDay, truncateAddress } from '@/lib/format'
import { claimedProofs } from '@/lib/proofs'
import { parseRecords, photoUrl, readField } from '@/lib/records'
import styles from './ContactCard.module.scss'

const ICON_SIZE = 18
const PHOTO_SIZE = 80
// A Universal Profile's picture beside its name; CSS sets the size it is shown at
const PROFILE_PICTURE_PX = 28
const { profile } = site

// Shown in the card's head rather than as rows
const HEAD_FIELDS = new Set(['avatar', 'name', 'job', 'about'])

const initialsOf = (text) =>
  String(text ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toUpperCase()

const External = ({ href, children }) => (
  <a className={styles.contact__link} href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
)

// A stored value as a visitor reads it: a link where it goes somewhere, text otherwise
function Value({ field, value }) {
  switch (field.type) {
    case 'email':
      return (
        <a className={styles.contact__link} href={`mailto:${value}`}>
          {value}
        </a>
      )
    case 'url':
      return /^https:\/\//i.test(value) ? <External href={value}>{value.replace(/^https:\/\//i, '')}</External> : value
    case 'date':
      return formatDay(value)
    case 'handle':
      return <External href={`${field.profile}${value}`}>@{value}</External>
    case 'address':
      return (
        <span className={styles.contact__address}>
          <AddressAvatar address={value} size="sm" />
          <span title={value}>{truncateAddress(value)}</span>
          <CopyButton value={value} title="Copy address" size={13} />
        </span>
      )
    default:
      return value
  }
}

// A Universal Profile shows the name and picture it publishes on LUKSO, and its address until
// they are read or where it publishes none
function ProfileValue({ field, value }) {
  const [brokenPicture, setBrokenPicture] = useState(null)
  const published = useUniversalProfile(value)
  // Records are written by any app, so what isn't an address is shown as it was written
  if (!isAddress(value)) return value
  const href = `${field.profile}${value}`
  if (!published?.name && !published?.image) {
    return (
      <span className={styles.contact__address}>
        <AddressAvatar address={value} size="sm" />
        <External href={href}>
          <span className={styles.contact__mono} title={value}>
            {truncateAddress(value)}
          </span>
        </External>
        <CopyButton value={value} title="Copy address" size={13} />
      </span>
    )
  }
  return (
    <span className={styles.contact__address}>
      {published.image && published.image !== brokenPicture ? (
        <Image
          className={styles.contact__picture}
          src={published.image}
          width={PROFILE_PICTURE_PX}
          height={PROFILE_PICTURE_PX}
          alt=""
          unoptimized
          onError={() => setBrokenPicture(published.image)}
        />
      ) : (
        <AddressAvatar address={value} />
      )}
      <External href={href}>{published.name ?? truncateAddress(value)}</External>
    </span>
  )
}

function Row({ icon: Icon, label, verified, children }) {
  return (
    <div className={styles.contact__row}>
      <span className={styles.contact__icon}>
        <Icon size={ICON_SIZE} aria-hidden="true" />
      </span>
      <div className={styles.contact__body}>
        <span className={styles.contact__label}>{label}</span>
        <span className={styles.contact__value} dir="auto">
          {children}
          {verified && <SealCheckIcon className={styles.contact__check} size={16} weight="fill" aria-label={site.verify.verified} />}
        </span>
      </div>
    </div>
  )
}

/**
 * A name's records as anyone reads them: a phone's contact card, its links live and its proven
 * accounts checked. `name` is a name as its page reads it.
 */
export default function ContactCard({ name }) {
  const titleId = useId()
  const [brokenPhoto, setBrokenPhoto] = useState(null)
  const document = parseRecords(name.stored)
  const value = (path) => readField(document, path)
  const proofs = claimedProofs(document)
  const verified = useVerification(name.display, name.stored, proofs.length > 0)
  const verifiedField = (path) => Boolean(verified[records.proofs.find((network) => network.field === path)?.id])

  const groups = records.groups
    .map((group) => ({ ...group, rows: group.fields.filter((field) => !HEAD_FIELDS.has(field.name) && value(field.name)) }))
    .filter((group) => group.rows.length > 0)
  const chains = addresses.chains
    .map((chain) => ({ chain, text: addressText(chain, name.addresses[chain.coin.coinType]) }))
    .filter(({ text }) => text)

  const photo = photoUrl(value('avatar'))
  const displayName = value('name')
  const initials = initialsOf(displayName)
  const subtitle = [value('job'), displayName ? name.display : null].filter(Boolean).join(' · ')
  const empty = !displayName && !value('about') && !photo && groups.length === 0 && chains.length === 0

  return (
    <section className={styles.contact} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.contact__title}>
        {profile.title}
      </h2>

      <div className={styles.contact__head}>
        <span className={styles.contact__photo}>
          {photo && photo !== brokenPhoto ? (
            <Image className={styles.contact__image} src={photo} width={PHOTO_SIZE} height={PHOTO_SIZE} alt="" unoptimized onError={() => setBrokenPhoto(photo)} />
          ) : initials ? (
            <span className={styles.contact__initials} aria-hidden="true">
              {initials}
            </span>
          ) : (
            <AddressAvatar address={name.target} className={styles.contact__gradient} />
          )}
        </span>
        <p className={styles.contact__name} dir="auto">
          {displayName || name.display}
        </p>
        {subtitle && (
          <p className={styles.contact__subtitle} dir="auto">
            {subtitle}
          </p>
        )}
        {value('about') && (
          <p className={styles.contact__about} dir="auto">
            {value('about')}
          </p>
        )}
      </div>

      {empty && (
        <EmptyState align="center" className={styles.contact__empty}>
          {profile.empty}
        </EmptyState>
      )}

      {groups.map((group) => (
        <section key={group.id} className={styles.contact__group} aria-label={group.label}>
          <h3 className={styles.contact__legend}>{group.label}</h3>
          <div className={styles.contact__list}>
            {group.rows.map((field) => (
              <Row key={field.name} icon={RECORD_ICONS[field.name] ?? FALLBACK_ICON} label={field.label} verified={field.type === 'handle' && verifiedField(field.name)}>
                {field.type === 'up' ? (
                  <ProfileValue field={field} value={value(field.name)} />
                ) : (
                  <Value field={field} value={value(field.name)} />
                )}
              </Row>
            ))}
          </div>
        </section>
      ))}

      {chains.length > 0 && (
        <section className={styles.contact__group} aria-label={profile.chains}>
          <h3 className={styles.contact__legend}>{profile.chains}</h3>
          <div className={styles.contact__list}>
            {chains.map(({ chain, text }) => (
              <Row key={chain.coin.coinType} icon={RECORD_ICONS['agent.payment']} label={chain.label}>
                <span className={styles.contact__address}>
                  <span className={styles.contact__mono} title={text}>
                    {truncateAddress(text, 8, 6)}
                  </span>
                  <CopyButton value={text} title="Copy address" size={13} />
                </span>
              </Row>
            ))}
          </div>
        </section>
      )}

      {groups.some((group) => group.id === 'social') && <p className={styles.contact__note}>{profile.proofNote}</p>}
    </section>
  )
}
