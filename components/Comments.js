import { useEffect, useRef } from 'react'

export default function Comments({ slug }) {
  // Temporarily disabled - need to properly configure Giscus in GitHub repository
  return (
    <div className="comments-section">
      <h3>Comments</h3>
      <div className="comments-placeholder">
        <p>Comments will be available soon.</p>
      </div>
    </div>
  )
}