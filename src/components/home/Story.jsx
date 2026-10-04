'use client'

import { useId } from 'react'
import { Reveal } from 'cube-motion/react'
import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import ChatDemo from '@/components/home/ChatDemo'
import Button from '@/components/ui/Button'
import { site } from '@/config/site'
import { focusSearch } from '@/lib/focusSearch'
import styles from './Story.module.scss'

/** Why a number: the pitch beside a chat that acts it out. */
export default function Story() {
  const titleId = useId()
  const { story } = site

  return (
    <section className={styles.story} aria-labelledby={titleId}>
      <Reveal targets="children" className={styles.story__copy}>
        <p className={styles.story__eyebrow}>{story.eyebrow}</p>
        <h2 id={titleId} className={styles.story__title}>
          {story.title}
        </h2>
        <p className={styles.story__body}>{story.body}</p>
        <Button size="lg" icon={<MagnifyingGlassIcon size={18} weight="bold" aria-hidden="true" />} onClick={focusSearch}>
          {story.cta}
        </Button>
        <p className={styles.story__note}>{story.note}</p>
      </Reveal>

      <ChatDemo />
    </section>
  )
}
