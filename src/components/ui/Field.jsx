import { useId } from 'react'
import clsx from 'clsx'
import styles from './Field.module.scss'

/**
 * A labelled form control: input, select or textarea. A `type="checkbox"` input lays out as a
 * row with the label after the box.
 * @param {'input'|'select'|'textarea'} [props.as='input']
 * @param {boolean} [props.mono] Monospace value, for addresses and lists.
 */
export default function Field({ label, hint, as: Tag = 'input', mono = false, className, children, ...rest }) {
  const id = useId()
  const isCheck = Tag === 'input' && rest.type === 'checkbox'

  return (
    <div className={clsx(styles.field, isCheck && styles['field--check'], className)}>
      <Tag
        id={id}
        className={clsx(
          styles.field__control,
          mono && styles['field__control--mono'],
          Tag === 'textarea' && styles['field__control--multiline'],
          isCheck && styles['field__control--check']
        )}
        {...rest}
      >
        {children}
      </Tag>
      <label htmlFor={id} className={styles.field__label}>
        {label}
      </label>
      {hint && <p className={styles.field__hint}>{hint}</p>}
    </div>
  )
}
