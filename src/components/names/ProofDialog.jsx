'use client'

import { forwardRef, useId, useImperativeHandle, useRef, useState } from 'react'
import { signMessage } from 'wagmi/actions'
import { ArrowSquareOutIcon, XIcon } from '@phosphor-icons/react'
import NativeDialog from '@/components/ui/NativeDialog'
import Button from '@/components/ui/Button'
import CopyButton from '@/components/ui/CopyButton'
import Field from '@/components/ui/Field'
import { toast } from '@/components/NextToast'
import { site } from '@/config/site'
import { config } from '@/config/wagmi'
import { namePath } from '@/lib/namespaces'
import { composeLink, proofMessage, proofPost } from '@/lib/proofs'
import { paymentError } from '@/lib/registryActions'
import styles from './ProofDialog.module.scss'

const { verify } = site
const fill = (template, values) => Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template)

/**
 * Proves one social account: the holder's wallet signs a statement, the account posts the
 * signature, and the post's link goes into the records with `onLink`. Nothing is sent onchain
 * here; the link is kept when the records are saved. Opened with `open(network, handle)`.
 */
const ProofDialog = forwardRef(function ProofDialog({ name, account, onLink }, ref) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const [claim, setClaim] = useState(null)
  const [post, setPost] = useState('')
  const [link, setLink] = useState('')
  const [signing, setSigning] = useState(false)

  useImperativeHandle(
    ref,
    () => ({
      open: (network, handle, current = '') => {
        setClaim({ network, handle })
        setPost('')
        setLink(current)
        dialogRef.current?.open()
      },
      close: () => dialogRef.current?.close(),
    }),
    []
  )

  const sign = async () => {
    setSigning(true)
    try {
      const message = proofMessage({ name: name.display, tokenId: name.tokenId, network: claim.network, handle: claim.handle })
      const signature = await signMessage(config, { account, message })
      setPost(proofPost({ name: name.display, link: `${window.location.origin}${namePath(name.namespace, name.label)}`, signature }))
    } catch (error) {
      toast(paymentError(error), 'error')
    } finally {
      setSigning(false)
    }
  }

  const use = (event) => {
    event.preventDefault()
    const value = link.trim()
    if (!claim.network.link.test(value)) return toast(`That isn’t a link to a post on ${claim.network.label}`, 'error')
    onLink(claim.network, value)
    dialogRef.current?.close()
  }

  return (
    <NativeDialog ref={dialogRef} lightDismiss className={styles.proof} aria-labelledby={titleId}>
      {claim && (
        <form className={styles.proof__form} onSubmit={use}>
          <header className={styles.proof__header}>
            <h2 id={titleId} className={styles.proof__title}>
              {fill(verify.title, { network: claim.network.label })}
            </h2>
            <Button variant="ghost" size="sm" iconOnly aria-label="Close" icon={<XIcon size={16} weight="bold" />} onClick={() => dialogRef.current?.close()} />
          </header>

          <ol className={styles.proof__steps}>
            <li className={styles.proof__step}>
              <p>{fill(verify.steps.sign, { name: name.display })}</p>
              <Button size="sm" loading={signing} onClick={sign} disabled={Boolean(post)}>
                {verify.sign}
              </Button>
            </li>
            <li className={styles.proof__step}>
              <p>{fill(verify.steps.post, { handle: `@${claim.handle}` })}</p>
              {post && (
                <>
                  <pre className={styles.proof__post}>{post}</pre>
                  <div className={styles.proof__row}>
                    <CopyButton value={post} label="Copy" title="Copy the post" variant="chip" />
                    <Button variant="link" size="sm" href={composeLink(claim.network, post)} icon={<ArrowSquareOutIcon size={14} />}>
                      {claim.network.label}
                    </Button>
                  </div>
                </>
              )}
            </li>
            <li className={styles.proof__step}>
              <p>{verify.steps.link}</p>
              <Field className={styles.proof__field} label={verify.linkLabel} type="url" placeholder={claim.network.placeholder} value={link} onChange={(event) => setLink(event.target.value)} />
            </li>
          </ol>

          <Button type="submit" block disabled={!link.trim()}>
            {verify.linkLabel}
          </Button>
        </form>
      )}
    </NativeDialog>
  )
})

export default ProofDialog
