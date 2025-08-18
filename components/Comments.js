import { useEffect } from 'react'

export default function Comments({ slug, title }) {
  useEffect(() => {
    // Reset Disqus for the current page
    if (window.DISQUS) {
      window.DISQUS.reset({
        reload: true,
        config: function () {
          this.page.identifier = slug
          this.page.url = `https://keithah.github.io/posts/${slug}/`
          this.page.title = title
        }
      })
    } else {
      // Load Disqus for the first time
      window.disqus_config = function () {
        this.page.url = `https://keithah.github.io/posts/${slug}/`
        this.page.identifier = slug
        this.page.title = title
      }
      
      const script = document.createElement('script')
      script.src = 'https://keithah-github-io.disqus.com/embed.js'
      script.setAttribute('data-timestamp', +new Date())
      script.async = true
      document.head.appendChild(script)
    }
  }, [slug, title])

  return (
    <div className="comments-section">
      <h3>Comments</h3>
      <div id="disqus_thread"></div>
      <noscript>
        Please enable JavaScript to view the{' '}
        <a href="https://disqus.com/?ref_noscript">
          comments powered by Disqus.
        </a>
      </noscript>
    </div>
  )
}