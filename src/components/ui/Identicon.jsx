import clsx from 'clsx'
import makeBlockie from 'ethereum-blockies-base64'
import styles from './Identicon.module.scss'

/**
 * The picture a wallet has without choosing one: the blockie of its address, the same one Hup
 * draws beside a profile.
 * @param {'sm'|'md'|'lg'} [props.size='md']
 */
export default function Identicon({ address, size = 'md', className }) {
  // Lowercased, so both spellings of an address draw one picture
  const picture = address ? makeBlockie(String(address).toLowerCase()) : null
  return (
    <span
      className={clsx(styles.identicon, styles[`identicon--${size}`], className)}
      style={picture ? { '--identicon': `url(${picture})` } : undefined}
      aria-hidden="true"
    />
  )
}
