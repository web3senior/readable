import clsx from 'clsx'
import styles from './EmptyState.module.scss'

const ICON_SIZE = { sm: 14, md: 16, lg: 22 }

/**
 * The one way a surface says it has nothing to show.
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {'start'|'center'} [props.align='start'] Centered stacks the icon above the text.
 * @param {React.ElementType} [props.icon] A Phosphor icon component.
 * @param {React.ReactNode} [props.action] A trailing way out.
 */
export default function EmptyState({ children, size = 'md', align = 'start', icon: Icon, action, as: Tag = 'div', className }) {
  return (
    <Tag className={clsx(styles.empty, styles[`empty--${size}`], styles[`empty--${align}`], className)} role="status">
      {Icon && <Icon size={ICON_SIZE[size] ?? ICON_SIZE.md} aria-hidden="true" />}
      <span className={styles.empty__text}>{children}</span>
      {action && <span className={styles.empty__action}>{action}</span>}
    </Tag>
  )
}
