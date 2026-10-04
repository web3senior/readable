'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { useSearchParams } from 'next/navigation'
import { Rise } from 'cube-motion/react'
import { CloudSlashIcon, MagnifyingGlassIcon } from '@phosphor-icons/react'
import SearchBox from '@/components/search/SearchBox'
import NamespaceFilter, { ALL } from '@/components/search/NamespaceFilter'
import NamespaceGuide from '@/components/search/NamespaceGuide'
import ResultCard from '@/components/search/ResultCard'
import AboutDialog from '@/components/search/AboutDialog'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import { ContentSpinner } from '@/components/Loading'
import { site } from '@/config/site'
import useDebouncedValue from '@/hooks/useDebouncedValue'
import useIsClient from '@/hooks/useIsClient'
import useNamespaces from '@/hooks/useNamespaces'
import useSearchHistory from '@/hooks/useSearchHistory'
import { placeholderFor } from '@/lib/query/examples'
import { parseQuery } from '@/lib/query/parse'
import { readLegacyHash, withSearch } from '@/lib/searchLink'
import styles from './SearchExperience.module.scss'

const listOr = new Intl.ListFormat('en', { type: 'disjunction' })

function Results({ parsed, namespaces, filterNamespace, onAbout, onPick }) {
  // Both hints follow whatever namespaces the registry holds
  const searchable = listOr.format(namespaces.map((namespace) => namespace.title.toLowerCase()))
  const suffixes = listOr.format(namespaces.map((namespace) => namespace.suffix).filter(Boolean))

  if (parsed.unknownSuffix) {
    return (
      <EmptyState size="lg" align="center" icon={MagnifyingGlassIcon}>
        “{parsed.unknownSuffix}” isn’t a supported extension yet.{suffixes && ` Try ${suffixes}.`}
      </EmptyState>
    )
  }

  if (parsed.candidates.length === 0) {
    return (
      <EmptyState size="lg" align="center" icon={MagnifyingGlassIcon}>
        {filterNamespace
          ? `“${parsed.input}” doesn’t fit ${filterNamespace.title.toLowerCase()}.`
          : `Nothing matches “${parsed.input}”. Search ${searchable}.`}
      </EmptyState>
    )
  }

  // The first candidate is the result; the same label under another namespace is a tap away
  const [result, ...others] = parsed.candidates

  // Keyed by the name, so each new result rises in afresh
  return (
    <Rise key={result.key} targets="children" className={styles.result}>
      <ResultCard candidate={result} onAbout={onAbout} onPick={onPick} />
      {others.length > 0 && (
        <div className={styles.result__others}>
          <span className={styles.result__also}>{site.search.also}</span>
          {others.map((candidate) => {
            // A word's keypad number says which word it is
            const keypad = candidate.keypad && site.search.keypad.replace('{word}', candidate.keypad.word)
            return (
              <button key={candidate.key} type="button" className={styles.result__other} title={keypad || undefined} onClick={() => onPick(candidate.name)}>
                {candidate.name}
              </button>
            )
          })}
        </div>
      )}
    </Rise>
  )
}

/**
 * The search and its result. A shared link carries the name as `?q=`, which the server reads,
 * so the page arrives searching. A link from before carries it after #, which never reaches the
 * server: it is read once the page is in the browser, and the search starts over with it.
 */
export default function SearchExperience({ initialQuery = '' }) {
  const isClient = useIsClient()
  const arrived = useMemo(() => (isClient && !initialQuery && readLegacyHash()) || initialQuery, [isClient, initialQuery])
  return <Search key={arrived} initialQuery={arrived} ready={isClient} />
}

function Search({ initialQuery, ready }) {
  const [query, setQuery] = useState(initialQuery)
  const [filter, setFilter] = useState(ALL)
  const [aboutNamespace, setAboutNamespace] = useState(null)
  const aboutRef = useRef(null)
  const { history, add, remove, clear } = useSearchHistory()
  const { namespaces, isLoading, isError, refetch } = useNamespaces()

  const debouncedQuery = useDebouncedValue(query, site.search.debounceMs)

  // The address can change under the search without the page starting over: the logo back to
  // `/`, or a link to another search, both served from the router's cache. When it names
  // something else than the search, the search follows it. The search's own writes to the
  // address name what it already holds, so they change nothing
  const addressQuery = useSearchParams().get(site.search.queryParam) ?? ''
  const [seenAddress, setSeenAddress] = useState(addressQuery)
  if (seenAddress !== addressQuery) {
    setSeenAddress(addressQuery)
    if (addressQuery.trim() !== debouncedQuery.trim()) setQuery(addressQuery)
  }

  // A filter whose namespace disappeared falls back to all
  const filterNamespace = namespaces.find((namespace) => namespace.id === filter) ?? null
  const activeNamespaces = useMemo(() => (filterNamespace ? [filterNamespace] : namespaces), [filterNamespace, namespaces])
  const parsed = useMemo(() => parseQuery(debouncedQuery, activeNamespaces, { keypad: true }), [debouncedQuery, activeNamespaces])
  const settling = query.trim() !== debouncedQuery.trim()

  // The address follows the search, so it can be shared, without a navigation, which would
  // re-run the page. A name an older link carried after # moves to the parameter. Nothing is
  // written until the address has been read, or a shared link would lose its name
  useEffect(() => {
    if (!ready) return
    const url = withSearch(window.location.href, debouncedQuery)
    url.hash = ''
    if (url.href !== window.location.href) window.history.replaceState(null, '', url)
  }, [debouncedQuery, ready])

  // An older link's # typed into the address of the open page
  useEffect(() => {
    const follow = () => {
      const legacy = readLegacyHash()
      if (legacy) setQuery(legacy)
    }
    window.addEventListener('hashchange', follow)
    return () => window.removeEventListener('hashchange', follow)
  }, [])

  // Only searches that produced something worth revisiting are remembered
  const commit = (value) => {
    const { candidates } = parseQuery(value, namespaces, { keypad: true })
    if (candidates.some((candidate) => candidate.valid)) add(value.trim())
  }

  const openAbout = (namespace) => {
    setAboutNamespace(namespace)
    aboutRef.current?.open()
  }

  const pickExample = (value) => {
    setQuery(value)
    commit(value)
  }

  let content
  if (isError) {
    content = (
      <EmptyState
        size="lg"
        align="center"
        icon={CloudSlashIcon}
        action={
          <Button variant="link" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        }
      >
        Couldn’t reach the registry.
      </EmptyState>
    )
  } else if (parsed.input && isLoading) {
    content = <ContentSpinner label="Loading namespaces" />
  } else if (parsed.input) {
    content = <Results parsed={parsed} namespaces={namespaces} filterNamespace={filterNamespace} onAbout={openAbout} onPick={pickExample} />
  } else if (!isLoading && namespaces.length === 0) {
    content = (
      <EmptyState size="lg" align="center" icon={MagnifyingGlassIcon}>
        Nothing to search yet. Namespaces appear here once the registry adds them.
      </EmptyState>
    )
  } else {
    content = <NamespaceGuide namespaces={namespaces} loading={isLoading} onExample={pickExample} onAbout={openAbout} />
  }

  return (
    // The page reads data-searching to step aside while a name is looked up
    <section className={styles.experience} data-searching={parsed.input ? '' : undefined}>
      <div className={styles.experience__controls}>
        <SearchBox
          value={query}
          onChange={setQuery}
          onCommit={commit}
          placeholder={placeholderFor(namespaces)}
          history={history}
          onRemoveHistory={remove}
          onClearHistory={clear}
        />
        {namespaces.length > 1 && <NamespaceFilter namespaces={namespaces} value={filterNamespace ? filter : ALL} onChange={setFilter} />}
      </div>

      <div className={clsx(styles.experience__results, settling && styles['experience__results--settling'])}>{content}</div>

      <AboutDialog ref={aboutRef} namespace={aboutNamespace} />
    </section>
  )
}
