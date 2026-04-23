import DOMPurify from 'dompurify'

interface SafeHTMLProps {
  html: string
  className?: string
}

export default function SafeHTML({ html, className }: SafeHTMLProps) {
  // Ye function kisi bhi <script> ya dangerous tag ko uda dega
  const cleanHTML = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'code', 'pre', 'br', 'p', 'ul', 'li'],
    ALLOWED_ATTR: [] // Extra safety: No 'onclick' or 'href'
  })

  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: cleanHTML }} 
    />
  )
}
