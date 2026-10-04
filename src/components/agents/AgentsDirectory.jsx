'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Rise } from 'cube-motion/react'
import { CloudSlashIcon, PlugsIcon, RobotIcon } from '@phosphor-icons/react'
import AddressAvatar from '@/components/ui/AddressAvatar'
import Button from '@/components/ui/Button'
import CopyButton from '@/components/ui/CopyButton'
import EmptyState from '@/components/ui/EmptyState'
import Shimmer from '@/components/ui/Shimmer'
import { registryEnabled } from '@/config/registry'
import { site } from '@/config/site'
import useAgents from '@/hooks/useAgents'
import { truncateAddress } from '@/lib/format'
import styles from './AgentsDirectory.module.scss'

const { agents: copy } = site
const PHOTO_SIZE = 48
const SKELETON_CARDS = 3

function Agent({ agent }) {
  const [broken, setBroken] = useState(false)
  return (
    <article className={styles.agent}>
      <header className={styles.agent__header}>
        <span className={styles.agent__photo}>
          {agent.avatar && !broken ? (
            <Image src={agent.avatar} width={PHOTO_SIZE} height={PHOTO_SIZE} alt="" unoptimized onError={() => setBroken(true)} className={styles.agent__image} />
          ) : (
            <RobotIcon size={22} aria-hidden="true" />
          )}
        </span>
        <div className={styles.agent__titles}>
          <Link className={styles.agent__name} href={agent.path} dir="auto">
            {agent.name}
          </Link>
          {agent.title && (
            <span className={styles.agent__title} dir="auto">
              {agent.title}
            </span>
          )}
        </div>
      </header>

      {agent.about && (
        <p className={styles.agent__about} dir="auto">
          {agent.about}
        </p>
      )}

      <dl className={styles.agent__rows}>
        {agent.endpoint && (
          <div className={styles.agent__row}>
            <dt className={styles.agent__term}>{copy.endpoint}</dt>
            <dd className={styles.agent__value}>
              <span className={styles.agent__mono} title={agent.endpoint}>
                {agent.endpoint.replace(/^https?:\/\//, '')}
              </span>
              <CopyButton value={agent.endpoint} title="Copy endpoint" size={13} />
            </dd>
          </div>
        )}
        {agent.erc8004 && (
          <div className={styles.agent__row}>
            <dt className={styles.agent__term}>{copy.erc8004}</dt>
            <dd className={styles.agent__value}>{agent.erc8004}</dd>
          </div>
        )}
        {agent.payment && (
          <div className={styles.agent__row}>
            <dt className={styles.agent__term}>{copy.payment}</dt>
            <dd className={styles.agent__value}>
              <AddressAvatar address={agent.payment} size="sm" />
              <span title={agent.payment}>{truncateAddress(agent.payment)}</span>
              <CopyButton value={agent.payment} title="Copy address" size={13} />
            </dd>
          </div>
        )}
      </dl>

      <Button variant="secondary" size="sm" href={agent.path}>
        {site.search.open}
      </Button>
    </article>
  )
}

/** Every name whose records reach an AI agent, newest first. */
export default function AgentsDirectory() {
  const { agents, isPending, isError, refetch } = useAgents()

  if (!registryEnabled) {
    return (
      <EmptyState size="lg" align="center" icon={PlugsIcon}>
        {site.names.gates.unconfigured}
      </EmptyState>
    )
  }
  if (isError) {
    return (
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
        {copy.unreachable}
      </EmptyState>
    )
  }
  if (isPending) {
    return (
      <div className={styles.agents}>
        {Array.from({ length: SKELETON_CARDS }, (_, index) => (
          <Shimmer key={index} className={styles.agents__skeleton} label={copy.loading} />
        ))}
      </div>
    )
  }
  if (agents.length === 0) {
    return (
      <EmptyState size="lg" align="center" icon={RobotIcon}>
        {copy.empty}
      </EmptyState>
    )
  }
  return (
    <Rise as="ul" targets="children" className={styles.agents}>
      {agents.map((agent) => (
        <li key={agent.tokenId}>
          <Agent agent={agent} />
        </li>
      ))}
    </Rise>
  )
}
