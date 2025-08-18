# Day One Blog Automation

Automated blog publishing system that transforms Day One journal entries into a Next.js blog via GitHub Actions.

## Features

- **Automated Processing**: GitHub Actions runs every 15 minutes to sync Day One entries
- **Rich Content**: Preserves formatting, images, and links from Day One
- **Clean URLs**: SEO-friendly URLs with category and tag support
- **Image Optimization**: Automatic download and EXIF stripping
- **Link Processing**: URL cleaning and expansion for better user experience
- **Error Handling**: Automatic GitHub issue creation for processing errors

## Architecture

```
Day One Journal → GitHub Actions → Content Processing → Next.js Blog
```

## Setup

1. Clone this repository
2. Install dependencies: `npm install`
3. Configure Day One API access
4. Set up GitHub Actions secrets
5. Deploy to Vercel or your preferred hosting

## Day One Configuration

Create three journals for content workflow:
- **Blog Drafts** - Work in progress, not processed
- **Blog Public** - Ready to publish, actively monitored by automation
- **Blog Published** - Successfully published entries, archived automatically

Use Day One Plus account for web export access.

## Content Structure

```
/posts/YYYY/MM/post-title.md
/images/YYYY/MM/image-name.png
/pages/blog/[category]/[slug].js
```

## URL Structure

- Categories: `/blog/software/`
- Tags: `/blog/tag/homeautomation/`
- Posts: `/blog/software/homekit-setup`

## Available Categories

Use these tags in Day One to categorize your posts:

- `hardware` - Hardware reviews, builds, repairs
- `software` - Software development, tools, tutorials
- `hacking` - Security research, CTFs, exploits
- `personal` - Personal thoughts, life updates
- `homeautomation` - Smart home, IoT projects
- `travel` - Travel stories, guides, experiences
- `finance` - Financial topics, investing, budgeting
- `str` - Strength training, fitness, health
- `biz` - Business, entrepreneurship, work
- `aidev` - AI development, machine learning, LLM projects
- `productmanagement` - Product strategy, roadmaps, user research

## Development

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run process-dayone  # Manual Day One processing
```

## License

MIT