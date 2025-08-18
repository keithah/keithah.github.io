import Link from 'next/link'
import { useRouter } from 'next/router'

export default function Layout({ children, categories = [], showSidebar = true }) {
  const router = useRouter()
  
  const isActiveRoute = (path) => {
    if (path === '/' && router.pathname === '/') return true
    if (path !== '/' && router.pathname.startsWith(path)) return true
    return false
  }

  return (
    <div className="site-layout">
      <header className="site-header">
        <div className="header-container">
          <Link href="/" className="site-logo">
            Keith Ah
          </Link>
          
          <nav className="main-nav">
            <Link 
              href="/" 
              className={`nav-link ${isActiveRoute('/') ? 'active' : ''}`}
            >
              Posts
            </Link>
            <Link 
              href="/projects" 
              className={`nav-link ${isActiveRoute('/projects') ? 'active' : ''}`}
            >
              Projects
            </Link>
            <Link 
              href="/about" 
              className={`nav-link ${isActiveRoute('/about') ? 'active' : ''}`}
            >
              About
            </Link>
          </nav>
        </div>
      </header>

      <div className="main-container">
        <main className="main-content">
          {children}
        </main>
        
        {showSidebar && (
          <aside className="sidebar">
            <div className="sidebar-section">
              <h3>Categories</h3>
              <div className="category-list">
                {categories.map((category) => (
                  <Link 
                    key={category.name} 
                    href={`/tag/${category.name}`}
                    className="category-item"
                  >
                    {category.name} ({category.count})
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}