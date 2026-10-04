'use client'

import { useId, useRef, useState } from 'react'
import Image from 'next/image'
import clsx from 'clsx'
import { getAddress, isAddress } from 'viem'
import { CameraIcon, SealCheckIcon } from '@phosphor-icons/react'
import AddressAvatar from '@/components/ui/AddressAvatar'
import Button from '@/components/ui/Button'
import { Spinner } from '@/components/Loading'
import { toast } from '@/components/NextToast'
import ProofDialog from '@/components/names/ProofDialog'
import { FALLBACK_ICON, RECORD_ICONS } from '@/components/names/recordIcons'
import { ipfs } from '@/config/ipfs'
import { records } from '@/config/records'
import { site } from '@/config/site'
import usePhotoUpload from '@/hooks/usePhotoUpload'
import useVerification from '@/hooks/useVerification'
import { FormError, actionError } from '@/lib/adminActions'
import { claimedProofs, proofPath } from '@/lib/proofs'
import { byteLength, parseRecords, photoUrl, profilePrefix, readField, serializeRecords, toHandle } from '@/lib/records'
import styles from './RecordsForm.module.scss'

const ICON_SIZE = 18
const PHOTO_SIZE = 80

const today = () => new Date().toISOString().slice(0, 10)

const ok = (value) => ({ value })
const refuse = (reason) => ({ reason })

const cleanAddress = (value) => (isAddress(value) ? ok(getAddress(value)) : refuse('is not a valid address'))

// What a field stores for what was typed, or why it can't
const CLEAN = {
  url: (value) => (records.links.test(value) ? ok(value) : refuse('must be an https://, ipfs:// or ar:// link')),
  email: (value) => (records.email.test(value) ? ok(value) : refuse('is not a valid email address')),
  date: (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value) && value <= today() ? ok(value) : refuse('is not a valid date')),
  address: cleanAddress,
  up: cleanAddress,
  handle: (value, field) => {
    const handle = toHandle(field, value)
    if (field.pattern.test(handle)) return ok(handle)
    return refuse(handle ? `handle “${handle}” is not valid` : 'needs a handle')
  },
}

/** The value a field stores; throws a FormError that names the field. */
function clean(field, raw) {
  const text = String(raw ?? '').trim()
  // Every field is optional; only what was typed is checked
  if (!text || !CLEAN[field.type]) return text
  const { value, reason } = CLEAN[field.type](text, field)
  if (reason) throw new FormError(`${field.label} ${reason}`)
  return value
}

// Up to two letters, as a phone shows a contact with no photo
const initialsOf = (text) =>
  String(text ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toUpperCase()

function Row({ field, value, onChange, disabled }) {
  const id = useId()
  const Icon = RECORD_ICONS[field.name] ?? FALLBACK_ICON
  const hintId = field.hint ? `${id}-hint` : undefined
  const handle = field.type === 'handle'
  const shared = {
    id,
    value: value ?? '',
    onChange: (event) => onChange(event.target.value),
    disabled,
    // A pasted profile link is longer than the handle it is cut down to, which the pattern checks
    maxLength: handle ? undefined : field.maxLength,
    placeholder: handle ? 'handle' : (field.placeholder ?? field.label),
    'aria-describedby': hintId,
    className: clsx(styles.records__input, (field.type === 'address' || field.type === 'up') && styles['records__input--mono']),
  }

  return (
    <div className={styles.records__row}>
      <span className={styles.records__icon}>
        <Icon size={ICON_SIZE} aria-hidden="true" />
      </span>
      <div className={styles.records__control}>
        <label htmlFor={id} className={styles.records__label}>
          {field.label}
        </label>
        <div className={styles.records__entry}>
          {handle && <span className={styles.records__prefix}>{profilePrefix(field)}</span>}
          {field.type === 'textarea' ? (
            <textarea rows={field.rows} {...shared} />
          ) : (
            <input
              type={field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'}
              inputMode={field.type === 'url' ? 'url' : undefined}
              autoComplete="off"
              spellCheck={field.type === 'text'}
              max={field.type === 'date' ? today() : undefined}
              {...shared}
            />
          )}
        </div>
        {field.hint && (
          <p id={hintId} className={styles.records__hint}>
            {field.hint}
          </p>
        )}
      </div>
    </div>
  )
}

// Under the social accounts: proving each one that has a handle, and whether its saved proof holds
function Proofs({ values, verified, disabled, onProve }) {
  const rows = records.proofs
    .map((network) => {
      const field = records.fields.find((candidate) => candidate.name === network.field)
      return { network, handle: toHandle(field, values[network.field]), link: String(values[proofPath(network)] ?? '').trim() }
    })
    .filter(({ handle }) => handle)
  if (rows.length === 0) return null

  return (
    <div className={styles.records__proofs}>
      {rows.map(({ network, handle, link }) => (
        <div key={network.id} className={styles.records__proof}>
          <span className={styles['records__proof-label']}>
            {verified[network.id] ? (
              <>
                <SealCheckIcon className={styles.records__check} size={16} weight="fill" aria-hidden="true" />
                {site.verify.verified}: {network.label}
              </>
            ) : link ? (
              `${network.label}: ${site.verify.unverified.toLowerCase()}`
            ) : (
              site.verify.title.replace('{network}', network.label)
            )}
          </span>
          <Button variant="link" size="sm" disabled={disabled} onClick={() => onProve(network, handle)}>
            {site.verify.action}
          </Button>
        </div>
      ))}
    </div>
  )
}

/**
 * A name's records as a phone shows a contact: the photo and the name on top, then the fields in
 * groups, one row each. It starts from what is stored (remount it by `key` when that changes);
 * saving sends the whole document. `proving` offers to prove the social accounts, which only the
 * holder's wallet can sign for, so an editor keeps the proofs it finds but can't add one.
 */
export default function RecordsForm({ name, account, perform, disabled = false, proving = true }) {
  const titleId = useId()
  const [values, setValues] = useState(() => {
    const document = parseRecords(name.stored)
    const paths = [...records.fields.map((field) => field.name), ...records.proofs.map(proofPath)]
    return Object.fromEntries(paths.map((path) => [path, readField(document, path)]))
  })
  const [sending, setSending] = useState(false)
  // The photo link that failed to load, so the initials stand in for it
  const [brokenPhoto, setBrokenPhoto] = useState(null)
  const photoUpload = usePhotoUpload()
  const fileRef = useRef(null)
  const proofRef = useRef(null)
  // What the site's check says of the proofs already saved
  const verified = useVerification(name.display, name.stored, claimedProofs(parseRecords(name.stored)).length > 0)

  const set = (field, value) => setValues((previous) => ({ ...previous, [field]: value }))

  const submit = async (event) => {
    event.preventDefault()
    setSending(true)
    try {
      const cleaned = Object.fromEntries(records.fields.map((field) => [field.name, clean(field, values[field.name])]))
      // A proof means nothing without the handle it proves
      for (const network of records.proofs) {
        const link = String(values[proofPath(network)] ?? '').trim()
        if (link && !network.link.test(link)) throw new FormError(`The ${network.label} proof must be a link to a post on ${network.label}`)
        cleaned[proofPath(network)] = cleaned[network.field] ? link : ''
      }
      const text = serializeRecords(name.stored, cleaned)
      if (byteLength(text) > records.maxBytes) throw new FormError(`Records can take ${records.maxBytes} bytes at most; shorten a field`)
      if (text === (name.stored ?? '')) throw new FormError('Nothing changed')
      await perform({
        functionName: 'setText',
        args: [name.tokenId, records.key, text],
        pending: `Saving the records of ${name.display}`,
        done: `Records of ${name.display} saved`,
      })
    } catch (error) {
      toast(actionError(error), 'error')
    } finally {
      setSending(false)
    }
  }

  // A picked photo is pinned on IPFS and its link put in the field; the records keep it once saved
  const choosePhoto = async (event) => {
    const [file] = event.target.files ?? []
    event.target.value = ''
    if (!file) return
    try {
      set('avatar', await photoUpload.upload(file))
      toast('Photo uploaded. Save records to keep it.', 'success')
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  const photo = photoUrl(values.avatar)
  const initials = initialsOf(values.name)
  const displayName = String(values.name ?? '').trim()
  const job = String(values.job ?? '').trim()
  const locked = sending || disabled
  const canUpload = photoUpload.enabled && !locked
  const pickPhoto = () => fileRef.current?.click()

  return (
    <section className={styles.records} aria-labelledby={titleId}>
      <form className={styles.records__form} onSubmit={submit} noValidate>
        <h2 id={titleId} className={styles.records__title}>
          Records
        </h2>

        <div className={styles.records__card}>
          <button
            type="button"
            className={styles.records__photo}
            onClick={pickPhoto}
            disabled={!canUpload || photoUpload.uploading}
            aria-label={photo ? 'Change the photo' : 'Add a photo'}
          >
            {photo && photo !== brokenPhoto ? (
              <Image
                className={styles.records__image}
                src={photo}
                width={PHOTO_SIZE}
                height={PHOTO_SIZE}
                alt=""
                unoptimized
                onError={() => setBrokenPhoto(photo)}
              />
            ) : initials ? (
              <span className={styles.records__initials} aria-hidden="true">
                {initials}
              </span>
            ) : (
              <AddressAvatar address={name.target ?? account} className={styles.records__gradient} />
            )}
            {photoUpload.enabled && (
              <span className={styles.records__camera} aria-hidden="true">
                {photoUpload.uploading ? <Spinner size={14} color="currentColor" /> : <CameraIcon size={14} weight="bold" />}
              </span>
            )}
          </button>
          {photoUpload.enabled && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept={Object.keys(ipfs.photo.types).join(',')}
                onChange={choosePhoto}
                className={styles.records__file}
                tabIndex={-1}
                aria-hidden="true"
              />
              <Button variant="link" size="sm" onClick={pickPhoto} disabled={!canUpload} loading={photoUpload.uploading}>
                {photo ? 'Change photo' : 'Add photo'}
              </Button>
            </>
          )}
          <p className={styles.records__name} dir="auto">
            {displayName || name.display}
          </p>
          <p className={styles.records__subtitle} dir="auto">
            {[job, displayName ? name.display : null].filter(Boolean).join(' · ') || 'No records yet'}
          </p>
        </div>

        <p className={styles.records__notice}>
          Anyone can read these, and the chain keeps every earlier version. Whoever holds the name next starts with none.
        </p>

        {records.groups.map((group) => (
          <section key={group.id} className={styles.records__group} aria-label={group.label ?? 'Profile'}>
            {group.label && <h3 className={styles.records__legend}>{group.label}</h3>}
            <div className={styles.records__list}>
              {group.fields.map((field) => (
                <Row key={field.name} field={field} value={values[field.name]} onChange={(value) => set(field.name, value)} disabled={locked} />
              ))}
            </div>
            {group.hint && <p className={styles.records__note}>{group.hint}</p>}
            {group.id === 'social' && proving && (
              <Proofs
                values={values}
                verified={verified}
                disabled={locked}
                onProve={(network, handle) => proofRef.current?.open(network, handle, values[proofPath(network)])}
              />
            )}
          </section>
        ))}

        <div className={styles.records__actions}>
          <Button type="submit" loading={sending} disabled={disabled}>
            Save records
          </Button>
        </div>
      </form>
      {/* Outside the form, since a dialog renders in place and a form can't hold another */}
      {proving && (
        <ProofDialog
          ref={proofRef}
          name={name}
          account={account}
          onLink={(network, link) => {
            set(proofPath(network), link)
            toast(`${network.label} proof added. Save records to keep it.`, 'success')
          }}
        />
      )}
    </section>
  )
}
