/** Who sent a request, as far as a throttle needs to tell: the first address the proxy names. */
export const visitorOf = (request) => request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'local'
