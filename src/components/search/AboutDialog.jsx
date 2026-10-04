'use client'

import { forwardRef, useId, useImperativeHandle, useRef } from 'react'
import { ArrowSquareOutIcon, XIcon } from '@phosphor-icons/react'
import NativeDialog from '@/components/ui/NativeDialog'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { chainNameFor } from '@/config/chains'
import styles from './AboutDialog.module.scss'

/** Explains one namespace, from its `about` config. Opened through the ref. */
const AboutDialog = forwardRef(function AboutDialog({ namespace }, ref) {
  const titleId = useId()
  const dialogRef = useRef(null)

  useImperativeHandle(
    ref,
    () => ({
      open: () => dialogRef.current?.open(),
      close: () => dialogRef.current?.close(),
    }),
    []
  )

  const about = namespace?.about

  return (
    <NativeDialog ref={dialogRef} lightDismiss className={styles.about} aria-labelledby={titleId}>
      {about && (
        <>
          <header className={styles.about__header}>
            <Badge tone="accent">{namespace.label}</Badge>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label="Close"
              icon={<XIcon size={16} weight="bold" />}
              onClick={() => dialogRef.current?.close()}
            />
          </header>
          <h2 id={titleId} className={styles.about__title}>
            {about.title}
          </h2>
          {about.body.map((paragraph) => (
            <p key={paragraph} className={styles.about__text}>
              {paragraph}
            </p>
          ))}
          <p className={styles.about__meta}>Lives on {chainNameFor(namespace.chainId)}</p>
          {about.learnMoreUrl && (
            <Button variant="secondary" block href={about.learnMoreUrl} icon={<ArrowSquareOutIcon size={16} />}>
              Learn more
            </Button>
          )}
        </>
      )}
    </NativeDialog>
  )
})

export default AboutDialog
