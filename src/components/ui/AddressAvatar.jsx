import clsx from 'clsx'
import styles from './AddressAvatar.module.scss'

// Two hues read from the address itself, so the same wallet always wears the same gradient
const huesFor = (address) => {
  const hex = String(address ?? '').replace(/^0x/i, '').padEnd(8, '0')
  return [Number.parseInt(hex.slice(0, 4), 16) % 360, Number.parseInt(hex.slice(-4), 16) % 360]
}

/**
 * Deterministic gradient avatar for a wallet address.
 * @param {'sm'|'md'} [props.size='md']
 */
export default function AddressAvatar({ address, size = 'md', className }) {
  const [from, to] = huesFor(address)
  return (
    <span
      className={clsx(styles.avatar, styles[`avatar--${size}`], className)}
      style={{ '--avatar-from': from, '--avatar-to': to }}
      aria-hidden="true"
    />
  )
}
