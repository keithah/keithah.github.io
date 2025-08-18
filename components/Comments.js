import { useEffect, useRef } from 'react'

export default function Comments({ slug }) {
  const commentsRef = useRef(null)

  useEffect(() => {
    // Clear existing comments
    if (commentsRef.current) {
      commentsRef.current.innerHTML = ''
    }

    // Create script element
    const script = document.createElement('script')
    script.src = 'https://giscus.app/client.js'
    script.setAttribute('data-repo', 'keithah/keithah.github.io')
    script.setAttribute('data-repo-id', 'R_kgDONpOlJw') // You'll need to get this from Giscus
    script.setAttribute('data-category', 'General')
    script.setAttribute('data-category-id', 'DIC_kwDONpOlJ84ClyPG') // You'll need to get this from Giscus
    script.setAttribute('data-mapping', 'pathname')
    script.setAttribute('data-strict', '0')
    script.setAttribute('data-reactions-enabled', '1')
    script.setAttribute('data-emit-metadata', '0')
    script.setAttribute('data-input-position', 'bottom')
    script.setAttribute('data-theme', 'light')
    script.setAttribute('data-lang', 'en')
    script.crossOrigin = 'anonymous'
    script.async = true

    // Append script to the comments container
    if (commentsRef.current) {
      commentsRef.current.appendChild(script)
    }

    // Cleanup function
    return () => {
      if (commentsRef.current) {
        commentsRef.current.innerHTML = ''
      }
    }
  }, [slug]) // Re-run when slug changes

  return (
    <div className="comments-section">
      <h3>Comments</h3>
      <div ref={commentsRef} className="giscus-container" />
    </div>
  )
}