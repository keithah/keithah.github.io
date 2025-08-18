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
          <table className="posts-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Title</th>
                <th>Image</th>
                <th>Categories</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.uuid}>
                  <td className="post-date">
                    {new Date(post.publishDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </td>
                  <td className="post-title-cell">
                    <Link href={`/posts/${post.slug}`} className="post-title-link">
                      {post.title}
                    </Link>
                    <div className="post-tags-row">
                      {post.tags.map(tag => (
                        <Link key={tag} href={`/tag/${tag}`} className="post-tag">
                          {tag}
                        </Link>
                      ))}
                    </div>
                  </td>
                  <td className="post-thumbnail">
                    {getFirstImage(post) && (
                      <img 
                        src={getFirstImage(post)} 
                        alt={post.title}
                        loading="lazy"
                      />
                    )}
                  </td>
                  <td className="post-categories-cell">
                    <div className="post-tags-row">
                      {post.tags.map(tag => (
                        <Link key={tag} href={`/tag/${tag}`} className="post-tag">
                          {tag}
                        </Link>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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