'use client'

import { forwardRef, useId, useImperativeHandle, useRef, useState } from 'react'
import { XIcon } from '@phosphor-icons/react'
import NativeDialog from '@/components/ui/NativeDialog'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import { toast } from '@/components/NextToast'
import { actionError } from '@/lib/adminActions'
import styles from './ActionDialog.module.scss'

/** One field of a spec, keyed by `type`: text (default), number, date, address, select, textarea, checkbox. */
export function SpecField({ field, value, onChange, disabled }) {
  const { name, label, type = 'text', hint, options, ...rest } = field
  const shared = { name, label, hint, disabled }

  if (type === 'select') {
    return (
      <Field as="select" {...shared} value={value ?? ''} onChange={(event) => onChange(event.target.value)} {...rest}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Field>
    )
  }
  if (type === 'textarea') {
    return <Field as="textarea" mono {...shared} value={value ?? ''} onChange={(event) => onChange(event.target.value)} {...rest} />
  }
  if (type === 'checkbox') {
    return <Field type="checkbox" {...shared} checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} {...rest} />
  }
  return (
    <Field
      type={type === 'number' || type === 'date' ? type : 'text'}
      inputMode={type === 'number' ? 'numeric' : undefined}
      mono={type === 'address'}
      spellCheck={false}
      autoComplete="off"
      {...shared}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      {...rest}
    />
  )
}

/**
 * The one dialog behind every owner action. `open(spec)` shows the spec's fields and hands the
 * values to its `submit`; the dialog closes once that resolves and toasts when it throws.
 * @typedef {{ title: string, description?: string, fields: object[], initial?: object, submitLabel?: string, tone?: 'danger', submit: (values: object) => Promise<void> }} ActionSpec
 */
const ActionDialog = forwardRef(function ActionDialog(_, ref) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const [spec, setSpec] = useState(null)
  const [values, setValues] = useState({})
  const [sending, setSending] = useState(false)

  useImperativeHandle(
    ref,
    () => ({
      open: (next) => {
        setSpec(next)
        setValues(next.initial ?? {})
        setSending(false)
        dialogRef.current?.open()
      },
      close: () => dialogRef.current?.close(),
    }),
    []
  )

  const set = (name, value) => setValues((previous) => ({ ...previous, [name]: value }))

  const submit = async (event) => {
    event.preventDefault()
    if (!spec) return
    setSending(true)
    try {
      await spec.submit(values)
      dialogRef.current?.close()
    } catch (error) {
      toast(actionError(error), 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <NativeDialog ref={dialogRef} lightDismiss className={styles.action} aria-labelledby={titleId}>
      <form className={styles.action__form} onSubmit={submit}>
        <header className={styles.action__header}>
          <h2 id={titleId} className={styles.action__title}>
            {spec?.title}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Close"
            icon={<XIcon size={16} weight="bold" />}
            onClick={() => dialogRef.current?.close()}
          />
        </header>

        {spec?.description && <p className={styles.action__description}>{spec.description}</p>}

        {spec?.fields.length > 0 && (
          <div className={styles.action__fields}>
            {spec.fields.map((field) => (
              <SpecField
                key={field.name}
                field={field}
                value={values[field.name]}
                onChange={(value) => set(field.name, value)}
                disabled={sending}
              />
            ))}
          </div>
        )}

        <Button type="submit" size="lg" block loading={sending} variant={spec?.tone === 'danger' ? 'secondary' : 'primary'}>
          {spec?.submitLabel ?? 'Confirm'}
        </Button>
      </form>
    </NativeDialog>
  )
})

export default ActionDialog
