import Link from 'next/link'
import Layout from '../../components/Layout'
import { getAllPosts, getAllTags } from '../../lib/posts'

export default function TagPage({ tag, posts, tagCategories }) {
  return (
    <Layout categories={tagCategories}>
      <div className="page-header">
        <h1>Posts tagged with "{tag}"</h1>
        <p>{posts.length} {posts.length === 1 ? 'post' : 'posts'}</p>
      </div>
      
      <div className="posts-grid">
        {posts.map((post) => (
          <article key={post.uuid} className="post-card">
            <Link href={`/posts/${post.slug}`} className="post-link">
              <div className="post-content">
                <h2 className="post-title">{post.title}</h2>
                <div className="post-meta">
                  <time className="post-date">
                    {new Date(post.publishDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </time>
                </div>
                <div className="post-tags">
                  {post.tags.map(tag => (
                    <span key={tag} className="post-tag">
                      {tag}
                    </span>
                  ))}
                </div>
                {post.excerpt && <p className="post-excerpt">{post.excerpt}</p>}
              </div>
            </Link>
          </article>
        ))}
      </div>
    </Layout>
  )
}

export async function getStaticProps({ params }) {
  const { tag } = params
  const allPosts = getAllPosts(['title', 'publishDate', 'tags', 'slug', 'uuid', 'excerpt'])
  const posts = allPosts.filter(post => post.tags && post.tags.includes(tag))
  
  // Get all tags for sidebar
  const allTags = getAllTags()
  const tagCategories = allTags.map(tagName => {
    const count = allPosts.filter(p => p.tags && p.tags.includes(tagName)).length
    return { name: tagName, count }
  }).sort((a, b) => b.count - a.count)
  
  return {
    props: {
      tag,
      posts,
      tagCategories,
    },
  }
}

export async function getStaticPaths() {
  const tags = getAllTags()
  
  const paths = tags.map(tag => ({
    params: { tag }
  }))
  
  return {
    paths,
    fallback: false
  }
}