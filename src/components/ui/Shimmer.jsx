import clsx from 'clsx'
import styles from './Shimmer.module.scss'

/** Skeleton block. Size and radius come from the consumer's className. */
export default function Shimmer({ className, style, label = 'Loading' }) {
  return <div className={clsx(styles.shimmer, className)} style={style} role="status" aria-label={label} aria-busy="true" />
}
