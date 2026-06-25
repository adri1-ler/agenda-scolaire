const MEDIA_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

interface Props {
  photoUrl?: string | null
  prenom?: string
  nom?: string
  /** Diameter in pixels */
  size?: number
  className?: string
}

/** Build a full URL from the relative path the API returns (e.g. /uploads/users/x.jpg). */
export function mediaUrl(path?: string | null): string | null {
  if (!path) return null
  return path.startsWith('http') ? path : `${MEDIA_BASE}${path}`
}

export default function Avatar({ photoUrl, prenom, nom, size = 36, className = '' }: Props) {
  const src = mediaUrl(photoUrl)
  const initials = `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase() || '?'
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) }

  if (src) {
    return (
      <img
        src={src}
        alt={`${prenom ?? ''} ${nom ?? ''}`.trim() || 'Avatar'}
        style={style}
        className={`rounded-full object-cover bg-warm-100 flex-shrink-0 ${className}`}
      />
    )
  }

  return (
    <div
      style={style}
      className={`rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold flex-shrink-0 ${className}`}
    >
      {initials}
    </div>
  )
}
