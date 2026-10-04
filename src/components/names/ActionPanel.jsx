'use client'

import { useId, useState } from 'react'
import Button from '@/components/ui/Button'
import { toast } from '@/components/NextToast'
import { SpecField } from '@/components/admin/ActionDialog'
import { actionError } from '@/lib/adminActions'
import styles from './ActionPanel.module.scss'

/**
 * A holder's change to a name, as a section of its page: the same spec the ActionDialog takes,
 * with its fields in place. Remount it (by `key`) when what it starts from changes.
 * @param {{ spec: import('@/components/admin/ActionDialog').ActionSpec, heading?: string, disabled?: boolean }} props
 */
export default function ActionPanel({ spec, heading = spec.title, disabled = false }) {
  const titleId = useId()
  const [values, setValues] = useState(spec.initial ?? {})
  const [sending, setSending] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setSending(true)
    try {
      await spec.submit(values)
    } catch (error) {
      toast(actionError(error), 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <form className={styles.panel__form} onSubmit={submit} noValidate>
        <h2 id={titleId} className={styles.panel__title}>
          {heading}
        </h2>
        {spec.description && <p className={styles.panel__description}>{spec.description}</p>}
        {spec.fields.length > 0 && (
          <div className={styles.panel__fields}>
            {spec.fields.map((field) => (
              <SpecField
                key={field.name}
                field={field}
                value={values[field.name]}
                onChange={(value) => setValues((previous) => ({ ...previous, [field.name]: value }))}
                disabled={sending || disabled}
              />
            ))}
          </div>
        )}
        <div className={styles.panel__actions}>
          <Button type="submit" loading={sending} disabled={disabled} variant={spec.tone === 'danger' ? 'secondary' : 'primary'}>
            {spec.submitLabel ?? 'Save'}
          </Button>
        </div>
      </form>
    </section>
  )
}
