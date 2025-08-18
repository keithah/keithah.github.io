import Layout from '../components/Layout'

export default function About() {
  return (
    <Layout showSidebar={false}>
      <div className="page-content">
        <h1>About</h1>
        <p>
          Welcome to my blog! I'm Keith, and I write about software development, 
          hardware projects, and technology insights.
        </p>
        <p>
          This blog is automatically generated from my Day One journal entries, 
          creating a seamless writing workflow from personal notes to published content.
        </p>
      </div>
    </Layout>
  )
}