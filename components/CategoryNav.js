import Link from 'next/link'
import { useRouter } from 'next/router'

export default function CategoryNav({ categories, currentCategory = null }) {
  const router = useRouter()
  
  if (!categories || categories.length === 0) {
    return null
  }

  return (
    <nav className="category-nav">
      <div className="category-links">
        <Link 
          href="/blog" 
          className={`category-link ${!currentCategory ? 'active' : ''}`}
        >
          All Posts
        </Link>
        
        {categories.map(category => (
          <Link 
            key={category.name} 
            href={`/blog/${category.name}`}
            className={`category-link ${currentCategory === category.name ? 'active' : ''}`}
          >
            {category.name} ({category.count})
          </Link>
        ))}
      </div>
    </nav>
  )
}