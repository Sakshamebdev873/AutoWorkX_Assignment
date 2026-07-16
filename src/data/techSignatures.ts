export interface TechSignature {
  name: string;
  category: string;
  /** Substrings to search for (case-insensitive) across script srcs, link hrefs, inline script bodies, and meta tag content. */
  htmlPatterns?: string[];
  /** Substrings to search for in response header names/values. */
  headerPatterns?: string[];
  /** Substrings to search for in cookie names. */
  cookiePatterns?: string[];
}

/**
 * Curated, hand-built fingerprint list (not exhaustive) covering the CMS/framework/analytics/commerce/support
 * tools most commonly seen on company marketing sites. Intentionally small and readable over pulling in a
 * full third-party fingerprint database.
 */
export const TECH_SIGNATURES: TechSignature[] = [
  // CMS / site builders
  { name: "WordPress", category: "CMS", htmlPatterns: ["wp-content", "wp-includes", "wp-json"] },
  { name: "Webflow", category: "CMS", htmlPatterns: ["webflow.com", "data-wf-site", "data-wf-page"] },
  { name: "Squarespace", category: "CMS", htmlPatterns: ["squarespace.com", "static1.squarespace"] },
  { name: "Wix", category: "CMS", htmlPatterns: ["wix.com", "wixstatic.com", "_wixCIDX"] },
  { name: "Shopify", category: "E-commerce", htmlPatterns: ["cdn.shopify.com", "Shopify.theme", "shopify-section"] },
  { name: "Drupal", category: "CMS", htmlPatterns: ["/sites/default/files", "drupal.js", "Drupal.settings"] },
  { name: "Joomla", category: "CMS", htmlPatterns: ["/media/jui/", "joomla"] },
  { name: "Ghost", category: "CMS", htmlPatterns: ["ghost.io", "content=\"ghost"] },
  { name: "HubSpot CMS", category: "CMS", htmlPatterns: ["hs-scripts.com", "hsforms.net", "hubspot.com"] },
  { name: "Contentful", category: "CMS", htmlPatterns: ["contentful.com"] },

  // Frameworks
  { name: "Next.js", category: "Framework", htmlPatterns: ["__next", "_next/static"] },
  { name: "Nuxt.js", category: "Framework", htmlPatterns: ["__nuxt", "_nuxt/"] },
  { name: "React", category: "Framework", htmlPatterns: ["react-dom", "data-reactroot", "__REACT_DEVTOOLS"] },
  { name: "Vue.js", category: "Framework", htmlPatterns: ["__vue__", "vue.runtime", "data-v-app"] },
  { name: "Angular", category: "Framework", htmlPatterns: ["ng-version", "ng-app"] },
  { name: "Svelte", category: "Framework", htmlPatterns: ["svelte-"] },
  { name: "Gatsby", category: "Framework", htmlPatterns: ["___gatsby", "gatsby-image"] },

  // Analytics / tag management
  { name: "Google Tag Manager", category: "Analytics", htmlPatterns: ["googletagmanager.com/gtm.js"] },
  { name: "Google Analytics", category: "Analytics", htmlPatterns: ["google-analytics.com", "gtag(", "ga('create'"] },
  { name: "Meta Pixel", category: "Analytics", htmlPatterns: ["connect.facebook.net", "fbq('init'"] },
  { name: "Hotjar", category: "Analytics", htmlPatterns: ["static.hotjar.com"] },
  { name: "Mixpanel", category: "Analytics", htmlPatterns: ["cdn.mxpnl.com"] },
  { name: "Segment", category: "Analytics", htmlPatterns: ["cdn.segment.com"] },
  { name: "Plausible", category: "Analytics", htmlPatterns: ["plausible.io/js"] },

  // Chat / support
  { name: "Intercom", category: "Customer Support", htmlPatterns: ["widget.intercom.io", "intercomSettings"] },
  { name: "Zendesk", category: "Customer Support", htmlPatterns: ["zdassets.com", "zendesk.com"] },
  { name: "Drift", category: "Customer Support", htmlPatterns: ["js.driftt.com"] },
  { name: "Crisp", category: "Customer Support", htmlPatterns: ["client.crisp.chat"] },
  { name: "Tawk.to", category: "Customer Support", htmlPatterns: ["embed.tawk.to"] },

  // Marketing / CRM
  { name: "HubSpot", category: "Marketing", htmlPatterns: ["hs-scripts.com", "hsforms.net"] },
  { name: "Marketo", category: "Marketing", htmlPatterns: ["munchkin.js", "marketo.com"] },
  { name: "Mailchimp", category: "Marketing", htmlPatterns: ["list-manage.com", "chimpstatic.com"] },
  { name: "Salesforce", category: "CRM", htmlPatterns: ["force.com", "salesforce.com/embeddedservice"] },

  // Payments
  { name: "Stripe", category: "Payments", htmlPatterns: ["js.stripe.com"] },
  { name: "PayPal", category: "Payments", htmlPatterns: ["paypalobjects.com", "paypal.com/sdk"] },

  // CDN / hosting / infra (often visible via headers)
  { name: "Cloudflare", category: "CDN/Infra", headerPatterns: ["cf-ray", "cloudflare"] },
  { name: "Vercel", category: "CDN/Infra", headerPatterns: ["x-vercel-id"], htmlPatterns: ["vercel.app"] },
  { name: "Netlify", category: "CDN/Infra", headerPatterns: ["x-nf-request-id"] },
  { name: "AWS CloudFront", category: "CDN/Infra", headerPatterns: ["x-amz-cf-id", "cloudfront"] },
  { name: "Fastly", category: "CDN/Infra", headerPatterns: ["x-served-by", "fastly"] },
  { name: "Nginx", category: "Web Server", headerPatterns: ["server: nginx"] },
  { name: "Apache", category: "Web Server", headerPatterns: ["server: apache"] },

  // JS libraries
  { name: "jQuery", category: "JS Library", htmlPatterns: ["jquery.min.js", "jquery.js"] },
  { name: "Bootstrap", category: "CSS Framework", htmlPatterns: ["bootstrap.min.css", "bootstrap.bundle"] },
  { name: "Tailwind CSS", category: "CSS Framework", htmlPatterns: ["tailwindcss"] },

  // Recruiting / careers platforms (useful for a Careers page)
  { name: "Greenhouse", category: "Recruiting", htmlPatterns: ["greenhouse.io"] },
  { name: "Lever", category: "Recruiting", htmlPatterns: ["jobs.lever.co"] },
  { name: "Workday", category: "Recruiting", htmlPatterns: ["myworkdayjobs.com"] },

  // Scheduling
  { name: "Calendly", category: "Scheduling", htmlPatterns: ["calendly.com"] },
];
