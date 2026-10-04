import clsx from 'clsx'
import styles from './Badge.module.scss'

/**
 * Small status pill.
 * @param {'neutral'|'accent'|'success'|'danger'|'warning'} [props.tone='neutral']
 */
export default function Badge({ tone = 'neutral', className, children, ...rest }) {
  return (
    <span className={clsx(styles.badge, styles[`badge--${tone}`], className)} {...rest}>
      {children}
    </span>
  )
}
