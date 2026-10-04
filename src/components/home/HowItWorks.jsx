'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Reveal } from 'cube-motion/react'
import { ChatCircleTextIcon, IdentificationCardIcon, PaperPlaneTiltIcon, RobotIcon } from '@phosphor-icons/react'
import clsx from 'clsx'
import { site } from '@/config/site'
import useNumberNamespace from '@/hooks/useNumberNamespace'
import { formatPrice } from '@/lib/format'
import { formatNumber } from '@/lib/query/numbers'
import HowItWorksScreens from './HowItWorksScreens'
import NumberMap from './NumberMap'
import styles from './HowItWorks.module.scss'

const { howItWorks } = site
const { steps } = howItWorks

const ICONS = { profile: IdentificationCardIcon, send: PaperPlaneTiltIcon, contact: ChatCircleTextIcon, agent: RobotIcon }

// How each scene plays. One that dials or types a number spells it first (`type`: from `at` ms,
// a character every `every` ms); its cues are counted from the end of that, in ms: step n has
// begun once n cues have passed. The scene starts again `length` ms after its typing
const SCENES = {
  profile: { cues: [500, 900, 1300, 1700, 2100], length: 6000 },
  send: { type: { at: 600, every: 85 }, cues: [350, 1300, 1550], length: 4800 },
  contact: { type: { at: 600, every: 85 }, cues: [350, 1300, 1550, 2200], length: 5600 },
  agent: { type: { at: 600, every: 230 }, cues: [350, 650, 1600, 2200, 2900], length: 6200 },
}

// A frame longer than this (a tab in the background) counts as this, so nothing is skipped
const MAX_FRAME_MS = 100
// How much of a scene's stage is on screen before it plays
const PLAY_THRESHOLD = 0.35

const START = { step: 0, typed: 0 }

const typingEnd = (scene, text) => (scene.type ? scene.type.at + text.length * scene.type.every : 0)

/** Where a scene stands `time` ms after it began, for a scene that spells `text`. */
const momentOf = (scene, text, time) => {
  const start = typingEnd(scene, text)
  const typed = scene.type ? Math.max(0, Math.min(text.length, Math.floor((time - scene.type.at) / scene.type.every) + 1)) : 0
  return { step: scene.cues.filter((cue) => time >= start + cue).length, typed }
}

const endOf = (scene, text) => ({ step: scene.cues.length, typed: scene.type ? text.length : 0 })

/** Copy with its `{number}`, `{agent}` and `{amount}` in place. */
const fillText = (text, values) => text.replace(/\{(\w+)\}/g, (token, key) => values[key] ?? token)

/** The same, with each value set apart from the words around it. */
const fill = (text, values, className) =>
  text.split(/(\{\w+\})/).map((part, index) => {
    const value = values[part.slice(1, -1)]
    return part.startsWith('{') && value ? (
      <span key={index} className={className}>
        {value}
      </span>
    ) : (
      part
    )
  })

/**
 * One row: what a number does, beside a phone that plays it. The scene plays while its stage is
 * on screen, starts again when it ends, and pauses under the mouse so it can be read. With
 * reduced motion it shows how it ends.
 */
function Scene({ step, flip, number, agentNumber }) {
  const titleId = useId()
  const stageRef = useRef(null)
  const clock = useRef(0)
  const [moment, setMoment] = useState(START)
  // Bumped each time the scene starts again, so the phone's screen rises in afresh
  const [round, setRound] = useState(0)
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [still, setStill] = useState(false)

  const scene = SCENES[step.id]
  const Icon = ICONS[step.id]
  // What the scene types: the holder's number into a field, or the agent's into a keypad
  const text = { send: number, contact: number, agent: agentNumber }[step.id] ?? ''
  const shown = still ? endOf(scene, text) : moment
  const values = { number, agent: agentNumber, amount: step.screen && formatPrice(step.screen.amount, step.screen.currency) }

  useEffect(() => {
    // Motion is asked about each time the stage comes and goes, so a change of setting is heard
    const observer = new IntersectionObserver(
      ([entry]) => {
        setStill(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
        setVisible(entry.isIntersecting)
      },
      { threshold: PLAY_THRESHOLD }
    )
    observer.observe(stageRef.current)
    return () => observer.disconnect()
  }, [])

  // One clock drives the scene and its typing. It rests off screen and under the mouse, and goes
  // on from where it rested
  useEffect(() => {
    if (still || !visible || hovered) return
    const total = typingEnd(scene, text) + scene.length
    let last
    let frame
    const tick = (now) => {
      clock.current = Math.min(total, clock.current + Math.min(MAX_FRAME_MS, now - (last ?? now)))
      last = now
      if (clock.current < total) {
        const next = momentOf(scene, text, clock.current)
        setMoment((current) => (current.step === next.step && current.typed === next.typed ? current : next))
        frame = requestAnimationFrame(tick)
      } else {
        clock.current = 0
        setMoment(START)
        setRound((count) => count + 1)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [still, visible, hovered, round, scene, text])

  // A mouse only: a tap would leave the scene paused with nothing to move off it
  const hover = (over) => (event) => event.pointerType === 'mouse' && setHovered(over)

  return (
    <div className={clsx(styles.how__scene, flip && styles['how__scene--flip'])} aria-labelledby={titleId} role="group">
      <Reveal targets="children" className={styles.how__copy}>
        <span className={styles.how__eyebrow}>
          <Icon size={18} weight="fill" aria-hidden="true" />
          {step.tab}
          {step.stage && <span className={styles.how__badge}>{site.docs.stages[step.stage]}</span>}
        </span>
        <h3 id={titleId} className={styles['how__copy-title']}>
          {step.title}
        </h3>
        <p className={styles['how__copy-body']}>{fill(step.body, values, styles.how__value)}</p>
      </Reveal>

      <div
        ref={stageRef}
        className={styles.how__stage}
        onPointerEnter={hover(true)}
        onPointerLeave={hover(false)}
      >
        <div className={styles.how__device} role="img" aria-label={fillText(step.label, values)}>
          <HowItWorksScreens
            id={step.id}
            round={round}
            copy={step}
            step={shown.step}
            typed={shown.typed}
            number={number}
            agentNumber={agentNumber}
            holder={howItWorks.holder}
            agent={howItWorks.agent}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * How it works: what one number answers with, then four things a number does, a row each, its
 * words on one side and a phone playing it on the other, the sides swapping row by row. The
 * number's profile with its addresses and records, a payment to it, a chat contact added by it,
 * and an AI agent dialled by its own.
 */
export default function HowItWorks({ className }) {
  const titleId = useId()
  const namespace = useNumberNamespace()
  const number = formatNumber(howItWorks.digits, namespace)
  const agentNumber = formatNumber(howItWorks.agent.digits, namespace)

  return (
    <section className={clsx(styles.how, className)} aria-labelledby={titleId}>
      <Reveal targets="children" className={styles.how__intro}>
        <h2 id={titleId} className={styles.how__title}>
          {howItWorks.title}
        </h2>
        <p className={styles.how__body}>{howItWorks.body}</p>
      </Reveal>

      <NumberMap number={number} />

      <div className={styles.how__scenes}>
        {steps.map((step, index) => (
          <Scene key={step.id} step={step} flip={index % 2 === 1} number={number} agentNumber={agentNumber} />
        ))}
      </div>
    </section>
  )
}
