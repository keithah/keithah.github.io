import Link from 'next/link'
import { useState } from 'react'

export default function TagCloud({ tags, currentTag = null }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  if (!tags || tags.length === 0) {
    return null
  }

  // Sort tags by frequency and alphabetically
  const sortedTags = tags
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count // Sort by count (descending)
      }
      return a.name.localeCompare(b.name) // Then alphabetically
    })

  const displayTags = isExpanded ? sortedTags : sortedTags.slice(0, 20)
  const hasMore = sortedTags.length > 20

  return (
    <div className="tag-cloud">
      <h3>Tags</h3>
      <div className="tags-container">
        {displayTags.map(tag => (
          <Link 
            key={tag.name} 
            href={`/blog/tag/${encodeURIComponent(tag.name)}`}
            className={`tag-cloud-item ${currentTag === tag.name ? 'active' : ''}`}
            style={{
              fontSize: `${Math.max(0.8, Math.min(1.4, 0.8 + (tag.count / 10) * 0.6))}rem`
            }}
          >
            {tag.name} ({tag.count})
          </Link>
        ))}
      </div>
      
      {hasMore && (
        <button 
          className="toggle-tags"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Show Less' : `Show All ${sortedTags.length} Tags`}
        </button>
      )}
    </div>
  )
}