'use client'

import clsx from 'clsx'
import { site } from '@/config/site'
import styles from './NamespaceFilter.module.scss'

export const ALL = 'all'

export default function NamespaceFilter({ namespaces, value, onChange }) {
  const options = [{ id: ALL, label: site.search.allLabel }, ...namespaces.map(({ id, label }) => ({ id, label }))]

  return (
    <div className={styles.filter} role="group" aria-label="Filter by namespace">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          className={clsx(styles.filter__chip, value === option.id && styles['filter__chip--active'])}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
