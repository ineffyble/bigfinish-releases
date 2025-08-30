import { Feed } from "https://esm.sh/feed@4.2.2"
import { DOMParser } from "https://esm.sh/linkedom";

const getParamsFromRequest = (reqUrl) => {
  const url = new URL(reqUrl)
  const [ _, feedType ] = url.pathname.split('.')
  return {
    feedType,
  }
}

const getLatestReleases = async () => {
  console.info('boop')
  const res = await fetch(`https://www.bigfinish.com/whats_new/`)
  if (res.status !== 200) {
    return {
      error: {
        statusCode: res.status
      },
    }
  }
  const body = await res.text()
  // console.info(body)
  const doc = new DOMParser().parseFromString(body)
  const releases = [...doc.querySelectorAll('.post-description .listing-block').filter(el => !el.innerHTML.includes('<span>Coming Soon</span>') && !el.innerHTML.includes('<span>Free</span>') && [...el.querySelectorAll('.product-current-price')].length > 0)]
    .map(r => {
      return {
        title: r.querySelector('img').getAttribute('title'),
        id: `https://www.bigfinish.com` + r.querySelector('.title-link').getAttribute('href'),
        link: `https://www.bigfinish.com` + r.querySelector('.title-link').getAttribute('href'),
        description: [...r.querySelectorAll('p')][1].innerText,
        author: [
          {
            name: 'Big Finish Productions',
            link: `https://www.bigfinish.com`
          },
        ],
        date: new Date(),
        image: `https://www.bigfinish.com` + r.querySelector('img').getAttribute('src')
      }
    })
  console.info(JSON.stringify(releases, null, 2))
  // console.log(doc)

  return {
    releases
  }
}

const projectToFeedMetadata = (eggbugNewsHostname, project) => {
  return {
    title: `${project.displayName} (${project.handle}) on Cohost!`,
    description: `${project.dek}`,
    id: `${COHOST_PATH}/${project.handle}`,
    link: `${COHOST_PATH}/${project.handle}`,
    image: project.avatarURL,
    favicon: `${COHOST_PATH}/static/a4f72033a674e35d4cc9.png`,
    generator: "eggbug.news",
    feedLinks: {
      json: `https://${eggbugNewsHostname}/${project.handle}.json`,
      atom: `https://${eggbugNewsHostname}/${project.handle}.atom`,
      rss: `https://${eggbugNewsHostname}/${project.handle}.rss`
    },
    author: {
      name: project.displayName,
      link: `${COHOST_PATH}/${project.handle}`,
    }
  }
}

const postToItemMetadata = (post) => {
  return {
    title: post.headline,
    id: post.singlePostPageUrl,
    link: post.singlePostPageUrl,
    description: post.plainTextBody,
    author: [
      {
        name: post.postingProject.displayName,
        link: `https://cohost.org/${post.postingProject.handle}`
      },
    ],
    date: new Date(post.publishedAt),
    image: post.blocks.length && post.blocks[0].type === 'attachment' ? post.blocks[0].attachment.fileURL : null
  }
}

export default async (request, context) => {
  const { feedType } = getParamsFromRequest(request.url)
  console.info('woo')
  let { error, releases } = await getLatestReleases()
  if (error) {
    return new Response(`Error`, {
      status: error.statusCode,
      statusText: `Error`
    })
  }

  const feed = new Feed({
    title: `Big Finish Releases`,
    description: `a hacky feed of Big Finish releases`,
    id: `https://bigfinish.enchanting.dev/latestreleases`,
    link: `https://bigfinish.enchanting.dev/latestreleases`,
    generator: "bigfinish.enchanting.dev",
    feedLinks: {
      json: `https://bigfinish.enchanting.dev/latestreleases.json`,
      atom: `https://bigfinish.enchanting.dev/latestreleases.atom`,
      rss: `https://bigfinish.enchanting.dev/latestreleases.rss`
    },
    author: {
      name: 'bigfinish.enchanting.dev',
      link: `https://bigfinish.enchanting.dev/latestreleases`,
    },
    updated: new Date(),
  });

  feed.addItem({
    title: 'Big Finish Releases Placeholder Item',
    id: `https://bigfinish.enchanting.dev/latestreleases`,
    link: `https://bigfinish.enchanting.dev/latestreleases`,
    description: 'This is a placeholder item so that the feed is never empty',
    author: [
      {
        name: 'Big Finish Productions',
        link: `https://www.bigfinish.com`
      },
    ],
    date: new Date(),
  })

  for (const release of releases) {
    feed.addItem({
      ...release,
      content: release.description,
    });
  }

  let response

  if (feedType === 'rss') {
    response = new Response(feed.rss2(), {
      headers: {
        "content-type": "application/rss+xml"
      }
    })
  }
  if (feedType === 'json') {
    response = new Response(feed.json1(), {
      headers: {
        "content-type": "application/json"
      }
    })
  }
  if (!feedType || feedType === 'atom') {
    response = new Response(feed.atom1(), {
      headers: {
        "content-type": "application/atom+xml"
      }
    })
  }
  if (!response) {
    response = new Response(`Unknown format: ${feedType}`, {
      status: 400,
      statusText: `Unknown format: ${feedType}`
    })
  }

  return response
}
