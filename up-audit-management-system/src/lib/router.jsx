// Minimal hash-based router (no external dependency).
// Routes look like "#/audits/a1" -> path "/audits/a1".
import { useEffect, useState, useCallback } from 'react'

export function getPath() {
  const h = window.location.hash || ''
  return h.startsWith('#') ? h.slice(1) || '/' : '/'
}

export function useRoute() {
  const [path, setPath] = useState(getPath)
  useEffect(() => {
    const onChange = () => setPath(getPath())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return path
}

export function navigate(to) {
  const target = to.startsWith('#') ? to : '#' + (to.startsWith('/') ? to : '/' + to)
  if (window.location.hash === target) return
  window.location.hash = target
  window.scrollTo({ top: 0 })
}

export function useNavigate() {
  return useCallback((to) => navigate(to), [])
}

// "/audits/:id" matching -> { params, match: bool }
export function matchPath(pattern, path) {
  const pParts = pattern.split('/').filter(Boolean)
  const aParts = path.split('?')[0].split('/').filter(Boolean)
  if (pParts.length !== aParts.length) return null
  const params = {}
  for (let i = 0; i < pParts.length; i++) {
    if (pParts[i].startsWith(':')) params[pParts[i].slice(1)] = decodeURIComponent(aParts[i])
    else if (pParts[i] !== aParts[i]) return null
  }
  return params
}

export function Link({ to, children, className, onClick, title }) {
  return (
    <a
      href={'#' + (to.startsWith('/') ? to : '/' + to)}
      className={className}
      title={title}
      onClick={(e) => {
        if (onClick) onClick(e)
        window.scrollTo({ top: 0 })
      }}
    >
      {children}
    </a>
  )
}
