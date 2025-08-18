import Layout from '../components/Layout'

export default function Projects() {
  return (
    <Layout showSidebar={false}>
      <div className="page-content">
        <h1>Projects</h1>
        <div className="projects-grid">
          <div className="project-card">
            <h3>Day One Blog Automation</h3>
            <p>
              Automated blog publishing system that converts Day One journal entries 
              into blog posts using GitHub Actions and Next.js.
            </p>
            <div className="project-tags">
              <span className="tag">Node.js</span>
              <span className="tag">Next.js</span>
              <span className="tag">GitHub Actions</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}