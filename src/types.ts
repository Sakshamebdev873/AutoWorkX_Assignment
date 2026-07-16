import { z } from "zod";

export const PageSnapshotSchema = z.object({
  url: z.string(),
  category: z.string(),
  title: z.string().nullable(),
  status: z.number().nullable(),
  ok: z.boolean(),
  error: z.string().nullable(),
  timingMs: z.number(),
  retries: z.number(),
  screenshots: z.object({
    desktop: z.string().nullable(),
    mobile: z.string().nullable(),
  }),
});
export type PageSnapshotMeta = z.infer<typeof PageSnapshotSchema>;

/** Internal working shape carried between crawl and extraction stages — not part of the public output schema. */
export interface PageSnapshot {
  url: string;
  category: string;
  title: string | null;
  html: string;
  headers: Record<string, string>;
  cookies: string[];
  status: number | null;
  ok: boolean;
  error: string | null;
  timingMs: number;
  retries: number;
  screenshots: { desktop: string | null; mobile: string | null };
}

export const ContactsSchema = z.object({
  emails: z.array(z.string()),
  phones: z.array(z.string()),
  contactForms: z.array(z.string()),
  departmentContacts: z.array(
    z.object({
      department: z.string(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
    }),
  ),
});

export const SocialLinksSchema = z.object({
  linkedin: z.string().nullable(),
  twitter: z.string().nullable(),
  facebook: z.string().nullable(),
  instagram: z.string().nullable(),
  github: z.string().nullable(),
  youtube: z.string().nullable(),
});

export const LeadershipMemberSchema = z.object({
  name: z.string(),
  title: z.string(),
  linkedin: z.string().nullable(),
  sourcePage: z.string(),
});

export const CrawlReportSchema = z.object({
  startedAt: z.string(),
  finishedAt: z.string(),
  durationMs: z.number(),
  pagesAttempted: z.number(),
  pagesSucceeded: z.number(),
  pagesFailed: z.number(),
  totalRetries: z.number(),
  errors: z.array(z.object({ url: z.string(), message: z.string() })),
});

export const CompanyProfileSchema = z.object({
  meta: z.object({
    inputUrl: z.string(),
    resolvedUrl: z.string(),
    domain: z.string(),
    crawledAt: z.string(),
    engineVersion: z.string(),
  }),
  company: z.object({
    name: z.string().nullable(),
    description: z.string().nullable(),
    industry: z.string().nullable(),
    headquarters: z.string().nullable(),
    locations: z.array(z.string()),
  }),
  products: z.array(z.string()),
  services: z.array(z.string()),
  technologies: z.array(z.object({ name: z.string(), category: z.string() })),
  branding: z.object({
    logo: z.string().nullable(),
    favicon: z.string().nullable(),
  }),
  contacts: ContactsSchema,
  socialLinks: SocialLinksSchema,
  leadership: z.array(LeadershipMemberSchema),
  aiSummary: z
    .object({
      summary: z.string(),
      industryClassification: z.string(),
      model: z.string(),
    })
    .nullable(),
  additionalWebInfo: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string(),
      }),
    )
    .nullable(),
  pagesCrawled: z.array(PageSnapshotSchema),
  crawlReport: CrawlReportSchema,
});

export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;
export type Contacts = z.infer<typeof ContactsSchema>;
export type SocialLinks = z.infer<typeof SocialLinksSchema>;
export type LeadershipMember = z.infer<typeof LeadershipMemberSchema>;
export type CrawlReport = z.infer<typeof CrawlReportSchema>;

export interface DiscoveredLink {
  url: string;
  text: string;
}

export interface RunOptions {
  url: string;
  maxPages: number;
  concurrency: number;
  headless: boolean;
  mobileScreenshots: boolean;
  llm: boolean;
  webSearch: boolean;
  outputDir: string;
}
