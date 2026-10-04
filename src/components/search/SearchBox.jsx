'use client'

import { useEffect, useId, useRef, useState } from 'react'
import clsx from 'clsx'
import { ClockCounterClockwiseIcon, MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react'
import NativePopover from '@/components/ui/NativePopover'
import { site } from '@/config/site'
import styles from './SearchBox.module.scss'

const isTypingTarget = (el) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))

// Items keep focus in the input on press, so a click lands before the input's blur closes the panel
const keepFocus = (event) => event.preventDefault()

/**
 * The search field, with recent searches in an anchored combobox panel while it's empty.
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {(value: string) => void} props.onCommit Enter, a picked recent search, or leaving the field.
 * @param {string} [props.placeholder]
 */
export default function SearchBox({ value, onChange, onCommit, placeholder = site.search.placeholder, history, onRemoveHistory, onClearHistory }) {
  const listId = useId()
  const inputRef = useRef(null)
  const fieldRef = useRef(null)
  const popoverRef = useRef(null)
  const arrivingRef = useRef(false)
  const [focused, setFocused] = useState(false)
  // Focused on arrival, the field keeps its recent searches shut until the visitor reaches for it
  const [quiet, setQuiet] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const showHistory = focused && !quiet && value.trim() === '' && history.length > 0

  useEffect(() => {
    if (showHistory) popoverRef.current?.open()
    else popoverRef.current?.close()
  }, [showHistory])

  // A phone would raise its keyboard over the page, so only a pointer that hovers gets the cursor
  useEffect(() => {
    if (!window.matchMedia(site.search.autoFocusMedia).matches) return
    arrivingRef.current = true
    inputRef.current?.focus({ preventScroll: true })
    arrivingRef.current = false
  }, [])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== site.search.focusKey || event.metaKey || event.ctrlKey || isTypingTarget(event.target)) return
      event.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const select = (item) => {
    setActiveIndex(-1)
    onChange(item)
    onCommit(item)
  }

  const moveActive = (step) => setActiveIndex((index) => (index + step + history.length) % history.length)

  const handleKeyDown = (event) => {
    setQuiet(false)
    if (!showHistory) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveActive(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveActive(-1)
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      select(history[activeIndex])
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onCommit(value)
  }

  return (
    <form role="search" className={styles.search} onSubmit={handleSubmit}>
      <div ref={fieldRef} className={clsx(styles.search__field, focused && styles['search__field--focused'])}>
        <MagnifyingGlassIcon className={styles.search__icon} size={22} aria-hidden="true" />
        <input
          ref={inputRef}
          id={site.search.inputId}
          type="search"
          role="combobox"
          className={styles.search__input}
          value={value}
          placeholder={placeholder}
          aria-label={site.search.label}
          aria-expanded={showHistory}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showHistory && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          dir="auto"
          onChange={(event) => {
            setActiveIndex(-1)
            onChange(event.target.value)
          }}
          onKeyDown={handleKeyDown}
          onPointerDown={() => setQuiet(false)}
          onFocus={() => {
            setFocused(true)
            setQuiet(arrivingRef.current)
          }}
          onBlur={() => {
            setFocused(false)
            setActiveIndex(-1)
            onCommit(value)
          }}
        />
        {value ? (
          <button
            type="button"
            className={styles.search__clear}
            aria-label="Clear search"
            onMouseDown={keepFocus}
            onClick={() => {
              onChange('')
              inputRef.current?.focus()
            }}
          >
            <XIcon size={16} weight="bold" aria-hidden="true" />
          </button>
        ) : (
          <kbd className={styles.search__key} aria-hidden="true">
            {site.search.focusKey}
          </kbd>
        )}
      </div>

      <NativePopover ref={popoverRef} anchorRef={fieldRef} type="manual" matchTriggerWidth className={styles.history}>
        <div className={styles.history__header}>
          <span>Recent</span>
          <button type="button" className={styles.history__clear} onMouseDown={keepFocus} onClick={onClearHistory}>
            Clear
          </button>
        </div>
        <ul id={listId} role="listbox" aria-label="Recent searches" className={styles.history__list}>
          {history.map((item, index) => (
            <li
              key={item}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={clsx(styles.history__item, index === activeIndex && styles['history__item--active'])}
              onMouseDown={keepFocus}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => select(item)}
            >
              <ClockCounterClockwiseIcon className={styles.history__icon} size={20} aria-hidden="true" />
              <span className={styles.history__text} dir="auto">
                {item}
              </span>
              <button
                type="button"
                className={styles.history__remove}
                aria-label={`Remove ${item} from recent searches`}
                onMouseDown={keepFocus}
                onClick={(event) => {
                  event.stopPropagation()
                  onRemoveHistory(item)
                }}
              >
                <XIcon size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </NativePopover>
    </form>
  )
}
