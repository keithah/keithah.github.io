import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'

export default function SearchModal({ posts = [], isOpen, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [showResults, setShowResults] = useState(false)
  const router = useRouter()
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

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
    }).slice(0, 8) // Show more results in modal

    setResults(searchResults)
    setShowResults(true)
  }, [query, posts])

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  const handleResultClick = () => {
    setQuery('')
    setShowResults(false)
    onClose()
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="search-modal-backdrop" onClick={handleBackdropClick}>
      <div className="search-modal">
        <div className="search-modal-header">
          <h3>Search Posts</h3>
          <button 
            onClick={onClose}
            className="search-modal-close"
            aria-label="Close search"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div className="search-modal-input-wrapper">
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            className="search-modal-icon"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search for posts, tags, or content..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="search-modal-input"
          />
        </div>
        
        {showResults && (
          <div className="search-modal-results">
            {results.length > 0 ? (
              <>
                <div className="search-results-header">
                  {results.length} result{results.length !== 1 ? 's' : ''} found
                </div>
                {results.map((post) => (
                  <Link
                    key={post.uuid}
                    href={`/posts/${post.slug}`}
                    className="search-modal-result"
                    onClick={handleResultClick}
                  >
                    <div className="search-modal-result-title">{post.title}</div>
                    <div className="search-modal-result-tags">
                      {post.tags?.map(tag => (
                        <span key={tag} className="search-modal-result-tag">{tag}</span>
                      ))}
                    </div>
                  </Link>
                ))}
              </>
            ) : (
              <div className="search-modal-no-results">
                No posts found for "{query}"
              </div>
            )}
          </div>
        )}
        
        {!showResults && query.trim().length === 0 && (
          <div className="search-modal-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <p>Start typing to search posts...</p>
          </div>
        )}
      </div>
    </div>
  )
}