'use client'

import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Morph, Rise } from 'cube-motion/react'
import { ChecksIcon, DotsThreeVerticalIcon, LockSimpleIcon } from '@phosphor-icons/react'
import { TypingDots } from '@/components/Loading'
import { site } from '@/config/site'
import useNumberNamespace from '@/hooks/useNumberNamespace'
import { formatNumber } from '@/lib/query/numbers'
import styles from './ChatDemo.module.scss'

const { chat } = site.story

const ME = 'me'
// The closing line is a step of the conversation like any message
const ITEMS = [...chat.messages, { system: true, text: chat.moved }]

const PAUSE_MS = 600
const SEND_MS = 500
// A reply is typed for as long as its text is, within these bounds
const TYPING_MS = { perCharacter: 40, min: 900, max: 1800 }
// How much of the chat is on screen before it starts
const START_THRESHOLD = 0.4

const isReply = (item) => !item.system && item.from !== ME

const typingTime = (item) => Math.min(TYPING_MS.max, Math.max(TYPING_MS.min, (item.text ?? '').length * TYPING_MS.perCharacter))

/** The home page chat: it plays once when scrolled into view, one message after another. */
export default function ChatDemo() {
  const rootRef = useRef(null)
  const [started, setStarted] = useState(false)
  const [shown, setShown] = useState(0)
  const [typing, setTyping] = useState(false)
  const namespace = useNumberNamespace()

  const number = formatNumber(chat.digits, namespace)
  // A sent message is read once a reply has come in after it
  const lastReply = ITEMS.findLastIndex((item, index) => index < shown && isReply(item))

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setShown(ITEMS.length)
        setStarted(true)
      },
      { threshold: START_THRESHOLD }
    )
    observer.observe(rootRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!started || shown >= ITEMS.length) return
    const next = ITEMS[shown]
    const reply = isReply(next)
    const timers = [
      setTimeout(() => setTyping(reply), PAUSE_MS),
      setTimeout(
        () => {
          setTyping(false)
          setShown((count) => count + 1)
        },
        PAUSE_MS + (reply ? typingTime(next) : SEND_MS)
      ),
    ]
    return () => timers.forEach(clearTimeout)
  }, [started, shown])

  return (
    <figure ref={rootRef} className={styles.chat} aria-label={chat.label}>
      <div className={styles.chat__header}>
        <span className={styles.chat__avatar} aria-hidden="true">
          {chat.contact.charAt(0)}
        </span>
        <div className={styles.chat__contact}>
          <span className={styles.chat__name}>{chat.contact}</span>
          <Morph className={styles.chat__status} active={typing} off={chat.status.idle} on={chat.status.typing} aria-hidden="true" />
        </div>
        <span className={styles.chat__tools} aria-hidden="true">
          <DotsThreeVerticalIcon size={20} weight="bold" />
        </span>
      </div>

      <ol className={styles.chat__thread}>
        <li className={clsx(styles.chat__row, styles['chat__row--system'])} aria-hidden="true">
          <span className={styles.chat__chip}>{chat.day}</span>
        </li>

        {ITEMS.map((item, index) => {
          const visible = index < shown
          // Same key, another element: the swap mounts the bubble, and mounting is what rises
          const Bubble = visible ? Rise : 'div'

          if (item.system) {
            return (
              <li key={index} className={clsx(styles.chat__row, styles['chat__row--system'], styles['chat__row--lead'])}>
                <Bubble className={clsx(styles.chat__chip, !visible && styles['chat__chip--pending'])}>
                  <LockSimpleIcon size={12} weight="fill" aria-hidden="true" />
                  {item.text}
                </Bubble>
              </li>
            )
          }

          const mine = item.from === ME
          const previous = ITEMS[index - 1]
          const lead = !previous || previous.system || previous.from !== item.from

          return (
            <li key={index} className={clsx(styles.chat__row, mine && styles['chat__row--me'], lead && styles['chat__row--lead'])}>
              {typing && index === shown && <TypingDots className={styles.chat__typing} />}
              <Bubble
                className={clsx(
                  styles.chat__bubble,
                  mine && styles['chat__bubble--me'],
                  lead && styles['chat__bubble--lead'],
                  !visible && styles['chat__bubble--pending']
                )}
              >
                <span className={styles.chat__sender}>{mine ? chat.me : chat.contact}: </span>
                <span className={clsx(styles.chat__text, item.number && styles['chat__text--number'])}>{item.number ? number : item.text}</span>
                {mine && (
                  <ChecksIcon
                    className={clsx(styles.chat__ticks, index < lastReply && styles['chat__ticks--read'])}
                    size={16}
                    weight="bold"
                    aria-hidden="true"
                  />
                )}
              </Bubble>
            </li>
          )
        })}
      </ol>
    </figure>
  )
}
