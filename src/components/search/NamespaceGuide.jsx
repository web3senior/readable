'use client'

import { useMemo } from 'react'
import { Rise } from 'cube-motion/react'
import { CaretRightIcon } from '@phosphor-icons/react'
import Shimmer from '@/components/ui/Shimmer'
import { chainNameFor } from '@/config/chains'
import useIsClient from '@/hooks/useIsClient'
import { examplesFor } from '@/lib/query/examples'
import styles from './NamespaceGuide.module.scss'

/** What an empty search can find: example queries, then one tile per namespace when there are several. */
export default function NamespaceGuide({ namespaces, loading, onExample, onAbout }) {
  // The server can't draw the random numbers the browser will, so a shimmer holds their place
  // until the page is in the browser
  const isClient = useIsClient()
  const examples = useMemo(() => examplesFor(namespaces, { draw: isClient }), [namespaces, isClient])

  return (
    <div className={styles.guide}>
      {examples.length > 0 && (
        <div className={styles.guide__examples}>
          <span className={styles.guide__try}>Try</span>
          {examples.map((example, index) =>
            example ? (
              <button key={index} type="button" className={styles.guide__example} onClick={() => onExample(example)}>
                {example}
              </button>
            ) : (
              <Shimmer key={index} className={styles['guide__example-skeleton']} label="Loading example" />
            )
          )}
        </div>
      )}

      {/* One namespace is already what the search says; the tiles only help pick among several.
          While loading the count is unknown, so nothing holds their place */}
      {!loading && namespaces.length > 1 && (
        <Rise as="ul" targets="children" className={styles.guide__grid}>
          {namespaces.map((namespace) => (
            <li key={namespace.id}>
              <button type="button" className={styles.guide__tile} onClick={() => onAbout(namespace)}>
                <span className={styles.guide__label}>{namespace.label}</span>
                <span className={styles.guide__title}>{namespace.title}</span>
                <span className={styles.guide__chain}>
                  {chainNameFor(namespace.chainId)}
                  <CaretRightIcon size={12} weight="bold" aria-hidden="true" />
                </span>
              </button>
            </li>
          ))}
        </Rise>
      )}
    </div>
  )
}
