import Link from 'next/link'
import Layout from '../components/Layout'
import { getAllPosts, getAllTags } from '../lib/posts'

export default function Home({ posts, tagCategories }) {
  const getFirstImage = (post) => {
    // Check if post has images array
    if (post.images && post.images.length > 0) {
      return `/images/2025/08/${post.images[0]}`
    }
    return null
  }

  return (
    <Layout categories={tagCategories} posts={posts} showSidebar={true}>
      <div className="home-layout">
        <div className="main-content">
          <div className="posts-list">
            {posts.map((post) => (
              <article key={post.uuid} className="post-card">
                <div className="post-date-column">
                  {new Date(post.publishDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
                
                <div className="post-content-column">
                  <Link href={`/posts/${post.slug}`} className="post-title-link">
                    <h2 className="post-title">{post.title}</h2>
                  </Link>
                  <div className="post-categories">
                    {post.tags.map(tag => (
                      <Link key={tag} href={`/tag/${tag}`} className="category-tag">
                        {tag.toUpperCase()}
                      </Link>
                    ))}
                  </div>
                  <p className="post-description">
                    Learn about {post.title.toLowerCase()} and explore key concepts through practical examples
                  </p>
                </div>
                
                <div className="post-image-column">
                  {getFirstImage(post) && (
                    <Link href={`/posts/${post.slug}`}>
                      <img 
                        src={getFirstImage(post)} 
                        alt={post.title}
                        loading="lazy"
                        className="post-featured-image"
                      />
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export async function getStaticProps() {
  const posts = getAllPosts(['title', 'publishDate', 'tags', 'slug', 'uuid', 'excerpt', 'content'])
  
  // Count posts per tag (using tags as categories)
  const allTags = getAllTags()
  const tagCategories = allTags.map(tagName => {
    const count = posts.filter(post => post.tags && post.tags.includes(tagName)).length
    return { name: tagName, count }
  }).sort((a, b) => b.count - a.count)
  
  return {
    props: {
      posts,
      tagCategories,
    },
  }
}