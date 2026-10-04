import {
  BriefcaseIcon,
  CakeIcon,
  EnvelopeSimpleIcon,
  GithubLogoIcon,
  GlobeIcon,
  IdentificationBadgeIcon,
  ImageIcon,
  MapPinIcon,
  NoteIcon,
  RobotIcon,
  TelegramLogoIcon,
  UserIcon,
  WalletIcon,
  XLogoIcon,
} from '@phosphor-icons/react'
import styles from './recordIcons.module.scss'

// Hup's mark is its logo file, painted in the row's ink like the icons beside it
function HupIcon() {
  return <span className={styles.mark} style={{ '--mark': 'url(/partners/hup.svg)' }} aria-hidden="true" />
}

// A Universal Profile wears LUKSO's mark, painted the same way
function LuksoIcon() {
  return <span className={styles.mark} style={{ '--mark': 'url(/partners/networks/lukso.svg)' }} aria-hidden="true" />
}

/** The icon of each record, by its path in the document, as a phone's contact card shows it. */
export const RECORD_ICONS = {
  avatar: ImageIcon,
  name: UserIcon,
  job: BriefcaseIcon,
  about: NoteIcon,
  email: EnvelopeSimpleIcon,
  url: GlobeIcon,
  location: MapPinIcon,
  birthday: CakeIcon,
  'social.x': XLogoIcon,
  'social.telegram': TelegramLogoIcon,
  'social.github': GithubLogoIcon,
  'social.hup': HupIcon,
  'social.up': LuksoIcon,
  'agent.endpoint': RobotIcon,
  'agent.erc8004': IdentificationBadgeIcon,
  'agent.payment': WalletIcon,
}

// For a record this list doesn't know
export const FALLBACK_ICON = NoteIcon
