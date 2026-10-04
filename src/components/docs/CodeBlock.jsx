import CopyButton from '@/components/ui/CopyButton'
import { site } from '@/config/site'
import styles from './CodeBlock.module.scss'

/**
 * A block of code with its language and a button that copies it.
 * @param {string} props.code
 * @param {string} [props.language] Shown above the code, as a reader would name it.
 */
export default function CodeBlock({ code, language }) {
  return (
    <figure className={styles.code}>
      <figcaption className={styles.code__bar}>
        <span className={styles.code__language}>{language}</span>
        <CopyButton value={code} title={site.docs.copyCode} />
      </figcaption>
      {/* Focusable, so a keyboard can scroll a line that runs past the edge */}
      <pre className={styles.code__body} tabIndex={0}>
        <code>{code}</code>
      </pre>
    </figure>
  )
}
