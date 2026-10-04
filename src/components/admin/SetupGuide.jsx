'use client'

import clsx from 'clsx'
import { CheckCircleIcon, CircleIcon } from '@phosphor-icons/react'
import Button from '@/components/ui/Button'
import { addNamespaceSpec, baseURISpec } from '@/components/admin/specs'
import { KIND, KIND_BY_INDEX } from '@/config/namespaces'
import { site } from '@/config/site'
import styles from './SetupGuide.module.scss'

const copy = site.admin.setup

/** What a fresh registry still needs before it can sell, in the order it needs it. Gone once done. */
export default function SetupGuide({ data, canAct, onAction, context }) {
  const args = { data, ...context }
  const steps = [
    {
      key: 'numbers',
      done: data.namespaces.some((namespace) => KIND_BY_INDEX[namespace.kind] === KIND.NUMBER),
      ready: true,
      spec: () => addNamespaceSpec({ ...args, kind: KIND.NUMBER }),
    },
    { key: 'link', done: Boolean(data.baseURI), ready: true, spec: () => baseURISpec(args) },
  ]
  if (steps.every((step) => step.done)) return null

  return (
    <section className={styles.setup} aria-labelledby="admin-setup">
      <h2 id="admin-setup" className={styles.setup__title}>
        {copy.title}
      </h2>
      <ol className={styles.setup__steps}>
        {steps.map((step) => {
          const Icon = step.done ? CheckCircleIcon : CircleIcon
          return (
            <li key={step.key} className={clsx(styles.setup__step, step.done && styles['setup__step--done'])}>
              <Icon className={styles.setup__mark} size={20} weight={step.done ? 'fill' : 'regular'} aria-hidden="true" />
              <div className={styles.setup__text}>
                <span className={styles.setup__label}>{copy.steps[step.key].label}</span>
                <span className={styles.setup__note}>{step.done ? copy.done : copy.steps[step.key].note}</span>
              </div>
              {!step.done && (
                <Button size="sm" disabled={!canAct || !step.ready} onClick={() => onAction(step.spec())}>
                  {copy.steps[step.key].action}
                </Button>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
