import styles from './Spec.module.scss'

/**
 * Rows of a term and what it stands for: what a table says, without a table's trouble on a phone.
 * @param {[React.ReactNode, React.ReactNode][]} props.rows
 * @param {string} [props.caption]
 */
export default function Spec({ caption, rows }) {
  return (
    <div className={styles.spec}>
      {caption && <p className={styles.spec__caption}>{caption}</p>}
      <dl>
        {rows.map(([term, value], index) => (
          <div key={index} className={styles.spec__row}>
            <dt className={styles.spec__term}>{term}</dt>
            <dd className={styles.spec__value}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
