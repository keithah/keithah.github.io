import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import { getAllPosts, getPostBySlug, getAllTags } from '../../lib/posts'
import { markdownToHtml } from '../../lib/markdownToHtml'

export default function PostPage({ post, tagCategories }) {
  const router = useRouter()
  
  if (router.isFallback) {
    return <div>Loading...</div>
  }

  return (
    <Layout categories={tagCategories}>
      <article className="post">
        <header className="post-header">
          <nav className="breadcrumb">
            <Link href="/">Home</Link> / 
            <Link href="/">Posts</Link> / 
            {post.title}
          </nav>
          
          <h1>{post.title}</h1>
          
          <div className="meta">
            <time>Published: {new Date(post.publishDate).toLocaleDateString()}</time>
            {post.editDate !== post.publishDate && (
              <time>Updated: {new Date(post.editDate).toLocaleDateString()}</time>
            )}
          </div>
          
          {post.tags.length > 0 && (
            <div className="tags">
              {post.tags.map(tag => (
                <Link key={tag} href={`/tag/${tag}`} className="tag">
                  {tag}
                </Link>
              ))}
            </div>
          )}
        </header>
        
        {post.images && post.images.length > 0 && (
          <div className="post-images">
            {post.images.map((image, index) => (
              <div key={index} className="image-container">
                <Image
                  src={`/images/${image}`}
                  alt={`Image ${index + 1}`}
                  width={800}
                  height={600}
                  style={{ objectFit: 'contain' }}
                />
              </div>
            ))}
          </div>
        )}
        
        <div 
          className="post-content"
          dangerouslySetInnerHTML={{ __html: post.content }} 
        />
        
        <footer className="post-footer">
          <div className="post-nav">
            <Link href="/">
              ← Back to Posts
            </Link>
          </div>
        </footer>
      </article>
    </Layout>
  )
}

export async function getStaticProps({ params }) {
  const { slug } = params
  const post = getPostBySlug(slug, [
    'title',
    'publishDate', 
    'editDate',
    'tags',
    'slug',
    'uuid',
    'images',
    'content'
  ])
  
  const content = await markdownToHtml(post.content || '')
  
  // Get all tags and count posts per tag
  const allPosts = getAllPosts(['tags'])
  const allTags = getAllTags()
  const tagCategories = allTags.map(tagName => {
    const count = allPosts.filter(p => p.tags && p.tags.includes(tagName)).length
    return { name: tagName, count }
  }).sort((a, b) => b.count - a.count)
  
  return {
    props: {
      post: {
        ...post,
        content,
      },
      tagCategories,
    },
  }
}

export async function getStaticPaths() {
  const posts = getAllPosts(['slug'])
  
  const paths = posts.map(post => ({
    params: { 
      slug: post.slug 
    }
  }))
  
  return {
    paths,
    fallback: false
  }
}