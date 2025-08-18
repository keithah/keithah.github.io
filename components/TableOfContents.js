import { useState, useEffect } from 'react'

export default function TableOfContents({ content }) {
  const [toc, setToc] = useState([])
  const [activeId, setActiveId] = useState('')

  useEffect(() => {
    // Extract headings from content
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = content
    
    const headings = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6')
    const tocItems = Array.from(headings).map((heading, index) => {
      const id = `heading-${index}`
      heading.id = id
      
      return {
        id,
        text: heading.textContent,
        level: parseInt(heading.tagName.charAt(1))
      }
    })
    
    setToc(tocItems)
    
    // Update the actual content with IDs
    const updatedContent = tempDiv.innerHTML
    document.querySelector('.post-content').innerHTML = updatedContent
  }, [content])

  useEffect(() => {
    const handleScroll = () => {
      const headings = document.querySelectorAll('.post-content h1, .post-content h2, .post-content h3, .post-content h4, .post-content h5, .post-content h6')
      
      let currentActiveId = ''
      
      // Find the heading that's currently in view
      for (let i = headings.length - 1; i >= 0; i--) {
        const heading = headings[i]
        const rect = heading.getBoundingClientRect()
        
        // Check if heading is above the viewport center
        if (rect.top <= window.innerHeight * 0.3) {
          currentActiveId = heading.id
          break
        }
      }
      
      setActiveId(currentActiveId)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Initial call
    
    return () => window.removeEventListener('scroll', handleScroll)
  }, [toc])

  const scrollToHeading = (id) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  if (toc.length === 0) return null

  return (
    <div className="toc-sidebar">
      <div className="toc">
        <h3>Table of Contents</h3>
        <ul>
          {toc.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  scrollToHeading(item.id)
                }}
                className={`toc-h${item.level} ${activeId === item.id ? 'active' : ''}`}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}