import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'

export default function Search({ posts = [] }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [showResults, setShowResults] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      setShowResults(false)
      return
    }

    const searchResults = posts.filter(post => {
      const searchTerm = query.toLowerCase()
      return (
        post.title?.toLowerCase().includes(searchTerm) ||
        post.tags?.some(tag => tag.toLowerCase().includes(searchTerm)) ||
        post.content?.toLowerCase().includes(searchTerm)
      )
    }).slice(0, 5) // Limit to 5 results

    setResults(searchResults)
    setShowResults(true)
  }, [query, posts])

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setQuery('')
      setShowResults(false)
    }
  }

  const handleResultClick = () => {
    setQuery('')
    setShowResults(false)
  }

  return (
    <div className="search-container">
      <div className="search-input-wrapper">
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          className="search-icon"
        >
          <circle cx="11" cy="11" r="8" />
          <Path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search posts..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="search-input"
        />
      </div>
      
      {showResults && (
        <div className="search-results">
          {results.length > 0 ? (
            results.map((post) => (
              <Link
                key={post.uuid}
                href={`/posts/${post.slug}`}
                className="search-result"
                onClick={handleResultClick}
              >
                <div className="search-result-title">{post.title}</div>
                <div className="search-result-tags">
                  {post.tags?.map(tag => (
                    <span key={tag} className="search-result-tag">{tag}</span>
                  ))}
                </div>
              </Link>
            ))
          ) : (
            <div className="search-no-results">No results found</div>
          )}
        </div>
      )}
    </div>
  )
}

// Fix the Path component
function Path({ d }) {
  return <path d={d} />
}