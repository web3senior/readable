'use client'

import { KIND, previewNamespaces } from '@/config/namespaces'
import useNamespaces from '@/hooks/useNamespaces'
import { toNamespace } from '@/lib/namespaces'

const isNumber = (namespace) => namespace.kind === KIND.NUMBER
// Until the registry answers, or if it holds no numbers, the launch format stands in
const FALLBACK_NAMESPACE = toNamespace(previewNamespaces.find(isNumber))

/** The namespace whose format the page writes numbers in: the registry's own, else the launch one. */
export default function useNumberNamespace() {
  const { namespaces } = useNamespaces()
  return namespaces.find(isNumber) ?? FALLBACK_NAMESPACE
}
