'use client'

import { Morph, Rise } from 'cube-motion/react'
import {
  CheckCircleIcon,
  CheckIcon,
  KeyIcon,
  LinkSimpleIcon,
  PhoneDisconnectIcon,
  PhoneIcon,
  PushPinIcon,
  RobotIcon,
  SealCheckIcon,
  UserPlusIcon,
  WalletIcon,
} from '@phosphor-icons/react'
import clsx from 'clsx'
import Image from 'next/image'
import Identicon from '@/components/ui/Identicon'
import { formatPrice, truncateAddress } from '@/lib/format'
import styles from './HowItWorksScreens.module.scss'

// The profile rows whose value is an address, shown shortened
const ADDRESS_ROWS = new Set(['evm', 'btc', 'sol'])

// A phone's keypad, each key with its letters; `+` is the long press of 0
const KEYS = [
  ['1', ''],
  ['2', 'ABC'],
  ['3', 'DEF'],
  ['4', 'GHI'],
  ['5', 'JKL'],
  ['6', 'MNO'],
  ['7', 'PQRS'],
  ['8', 'TUV'],
  ['9', 'WXYZ'],
  ['*', ''],
  ['0', '+'],
  ['#', ''],
]
const keyOf = (character) => (character === '+' ? '0' : KEYS.find(([key]) => key === character)?.[0])

const ICON = 18
// A row's logo at the icon's circle; CSS sets the size it is shown at
const LOGO_PX = 32
// The badge file's own size; CSS sets the size it is shown at
const BADGE_PX = 112

// Holds its place until it is shown, then rises into it: swapping the element is what mounts it
function Beat({ shown, as: Element = 'div', className, children }) {
  if (shown) {
    return (
      <Rise as={Element} className={className}>
        {children}
      </Rise>
    )
  }
  return <Element className={clsx(className, styles.pending)}>{children}</Element>
}

// The holder's name with its badge after it
function HolderName({ holder, className }) {
  return (
    <span className={clsx(styles.holder, className)}>
      {holder.name}
      {holder.badge && (
        <Image className={styles.holder__badge} src={holder.badge.src} width={BADGE_PX} height={BADGE_PX} alt={holder.badge.label} />
      )}
    </span>
  )
}

// A field the number is typed into, one character at a time
function Field({ label, text, typed, placeholder, focused }) {
  const value = text.slice(0, typed)
  return (
    <div className={styles.field}>
      <span className={styles.field__label}>{label}</span>
      <span className={clsx(styles.field__box, focused && styles['field__box--focused'])}>
        {value || <span className={styles.field__placeholder}>{placeholder}</span>}
        {focused && <span className={styles.caret} />}
      </span>
    </div>
  )
}

// The screen's main button: pressed, then done
function Action({ pressed, done, off, on, tone = 'accent' }) {
  return (
    <span className={clsx(styles.action, styles[`action--${tone}`], pressed && styles['action--pressed'])}>
      <Morph
        active={done}
        off={off}
        on={
          <span className={styles.action__done}>
            <CheckIcon size={16} weight="bold" />
            {on}
          </span>
        }
      />
    </span>
  )
}

function ProfileScreen({ copy, step, number, holder }) {
  return (
    <div className={styles.screen__body}>
      <div className={styles.profile}>
        <Identicon address={holder.address} size="lg" />
        <span className={styles.profile__text}>
          <HolderName holder={holder} className={styles.profile__name} />
          <span className={styles.profile__number}>{number}</span>
        </span>
      </div>
      <ul className={styles.rows}>
        {copy.rows.map((row, index) => {
          const address = ADDRESS_ROWS.has(row.id)
          const value = row.value ?? holder.address
          return (
            <Beat key={row.id} as="li" shown={step > index} className={styles.row}>
              <span className={clsx(styles.row__icon, styles[`row__icon--${row.id}`])}>
                <Image className={styles.row__logo} src={row.logo} width={LOGO_PX} height={LOGO_PX} alt="" />
              </span>
              <span className={styles.row__text}>
                <span className={styles.row__label}>{row.label}</span>
                <span className={clsx(styles.row__value, address && styles['row__value--address'])}>
                  {address ? truncateAddress(value, 8, 6) : value}
                </span>
              </span>
            </Beat>
          )
        })}
      </ul>
    </div>
  )
}

function SendScreen({ copy, step, typed, number, holder }) {
  const { screen } = copy
  return (
    <div className={styles.screen__body}>
      <span className={styles.screen__title}>{screen.title}</span>
      <span className={styles.amount}>{formatPrice(screen.amount, screen.currency)}</span>
      <Field label={screen.to} text={number} typed={typed} placeholder={screen.placeholder} focused={step === 0} />
      <Beat shown={step >= 1} className={styles.match}>
        <Identicon address={holder.address} size="md" />
        <span className={styles.match__text}>
          <HolderName holder={holder} className={styles.match__name} />
          <span className={styles.match__address}>{truncateAddress(holder.address)}</span>
        </span>
        <CheckCircleIcon className={styles.match__check} size={20} weight="fill" />
      </Beat>
      <Action pressed={step === 2} done={step >= 3} off={screen.action} on={screen.done} />
    </div>
  )
}

function ContactScreen({ copy, step, typed, number, holder }) {
  const { screen } = copy
  return (
    <>
      <div className={styles.chatbar}>
        <UserPlusIcon size={ICON} weight="bold" />
        {screen.title}
      </div>
      <div className={styles.screen__body}>
        <Field label={screen.field} text={number} typed={typed} focused={step === 0} />
        <Beat shown={step >= 1} className={styles.card}>
          <span className={styles.card__head}>
            <Identicon address={holder.address} size="md" />
            <span className={styles.card__text}>
              <HolderName holder={holder} className={styles.card__name} />
              <span className={styles.card__number}>{number}</span>
            </span>
          </span>
          <span className={styles.card__row}>
            <span className={styles.card__key}>
              <WalletIcon size={14} weight="fill" />
              {screen.wallet}
            </span>
            <span className={styles.card__value}>{truncateAddress(holder.address)}</span>
          </span>
          <span className={styles.card__row}>
            <span className={styles.card__key}>
              <KeyIcon size={14} weight="fill" />
              {screen.key}
            </span>
            <span className={styles.card__value}>{truncateAddress(screen.keyValue)}</span>
          </span>
        </Beat>
        <Action pressed={step === 2} done={step >= 3} off={screen.action} on={screen.done} tone="chat" />
        <Beat shown={step >= 4} className={styles.note}>
          <PushPinIcon className={styles.note__icon} size={14} weight="fill" />
          {screen.pinned}
        </Beat>
      </div>
    </>
  )
}

function AgentScreen({ copy, step, typed, agentNumber, agent }) {
  const { screen } = copy
  // The key under the finger while the number is dialled
  const pressed = step === 0 && typed > 0 ? keyOf(agentNumber[typed - 1]) : null
  const connected = step >= 3
  return (
    <div className={clsx(styles.dialer, step >= 2 && styles['dialer--calling'])}>
      <span className={styles.dialer__display}>
        {agentNumber.slice(0, typed)}
        {step === 0 && <span className={styles.caret} />}
      </span>
      <span className={styles.keypad}>
        {KEYS.map(([key, letters]) => (
          <span key={key} className={clsx(styles.key, key === pressed && styles['key--pressed'])}>
            <span className={styles.key__digit}>{key}</span>
            {letters && <span className={styles.key__letters}>{letters}</span>}
          </span>
        ))}
      </span>
      <span className={clsx(styles.call, step === 1 && styles['call--pressed'])}>
        <PhoneIcon size={24} weight="fill" />
      </span>

      <Rise show={step >= 2} className={styles.callview}>
        <span className={clsx(styles.callview__avatar, !connected && styles['callview__avatar--ringing'])}>
          <RobotIcon size={34} weight="fill" />
        </span>
        <span className={styles.callview__name}>{agent.name}</span>
        <span className={styles.callview__number}>
          {agentNumber} · {agent.role}
        </span>
        <Morph className={styles.callview__status} active={connected} off={screen.calling} on={screen.connected} />
        <Beat shown={step >= 4} className={styles.facts}>
          <span className={styles.card__row}>
            <span className={styles.card__key}>
              <LinkSimpleIcon size={14} weight="bold" />
              {screen.endpoint}
            </span>
            <span className={styles.card__value}>{agent.endpoint}</span>
          </span>
          <span className={styles.card__row}>
            <span className={styles.card__key}>
              <SealCheckIcon size={14} weight="fill" />
              {screen.erc8004}
            </span>
            <span className={styles.card__value}>ERC-8004 #{agent.erc8004}</span>
          </span>
        </Beat>
        <Beat shown={step >= 5} className={styles.bubble}>
          {screen.greeting}
        </Beat>
        <span className={styles.hangup}>
          <PhoneDisconnectIcon size={22} weight="fill" />
        </span>
      </Rise>
    </div>
  )
}

const SCREENS = { profile: ProfileScreen, send: SendScreen, contact: ContactScreen, agent: AgentScreen }

/**
 * The phone on a How it works stage, showing one scene at the moment it has reached: `step`
 * cues have passed and `typed` characters of its number are in. Every part holds its place from
 * the start, so nothing moves when the next one rises in. Each `round` of the scene rises in
 * afresh, so starting again doesn't snap the screen back.
 */
export default function HowItWorksScreens({ id, round, ...props }) {
  const Screen = SCREENS[id]
  return (
    <div className={clsx(styles.screen, styles[`screen--${id}`])}>
      <span className={styles.screen__notch} />
      <Rise key={round} className={styles.screen__scene}>
        <Screen {...props} />
      </Rise>
    </div>
  )
}
