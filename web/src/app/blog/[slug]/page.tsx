import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TemplateStatsBlock from "@/components/blog/TemplateStatsBlock";
import { ARTICLE_BODIES } from "@/components/blog/articles";
import Card from "@/components/ui/Card";
import { DISCLAIMER } from "@/lib/constants";
import { BLOG_POSTS, categoryBySlug, postBySlug } from "@/lib/blog";

/* Article pages (P1-1). dynamicParams:false makes the registry the slug
   allowlist. The whole app renders per-request (the root layout reads
   cookies), so a registry entry without a body component is caught by the
   loud throw below — a 500 with a clear message, never a silent 404 on a
   sitemap-advertised URL. Stats blocks revalidate on their own 6h cadence
   inside TemplateStatsBlock. */

export const dynamicParams = false;

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = postBySlug(slug);
  if (!post) return {};
  return {
    title: `${post.title} — Chat·Backtest`,
    description: post.description,
    keywords: [post.targetKeyword],
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.publishedAt,
    },
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = postBySlug(slug);
  if (!post) notFound();
  const Body = ARTICLE_BODIES[slug];
  if (!Body) {
    // Registry/body drift is an authoring bug — fail loudly, don't 404 a
    // URL the sitemap advertises.
    throw new Error(`blog registry entry "${slug}" has no body component`);
  }
  const category = categoryBySlug(post.category)!;
  const siblings = post.siblings
    .map((s) => postBySlug(s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <main className="mx-auto w-full max-w-(--container-max) px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-[70ch]">
        <nav aria-label="Breadcrumb" className="text-caption text-faint">
          <Link href="/blog" className="focus-ring rounded-(--radius-tag) hover:text-ink">
            Blog
          </Link>{" "}
          /{" "}
          <Link
            href={`/blog/category/${category.slug}`}
            className="focus-ring rounded-(--radius-tag) hover:text-ink"
          >
            {category.name}
          </Link>
        </nav>
        <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight tracking-tight text-ink">
          {post.title}
        </h1>
        <p className="tnum mt-3 text-caption text-faint">
          {new Date(`${post.publishedAt}T00:00:00Z`).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "UTC",
          })}{" "}
          · {post.readingMinutes} min read · research &amp; education, not financial
          advice
        </p>

        <article className="docs-prose mt-8">
          <Body
            stats={
              post.templateId ? (
                <TemplateStatsBlock templateId={post.templateId} />
              ) : undefined
            }
          />
        </article>

        {/* Internal-links block (spec §P1-1): 2 siblings + the leaderboard. */}
        <section aria-label="Keep reading" className="mt-12 border-t border-hairline pt-8">
          <h2 className="text-caption uppercase tracking-widest text-muted">
            Keep reading
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {siblings.map((s) => (
              <Card key={s.slug} pad="none" className="card-hover">
                <Link
                  href={`/blog/${s.slug}`}
                  className="focus-ring block h-full p-5"
                >
                  <p className="text-caption uppercase tracking-widest text-faint">
                    {categoryBySlug(s.category)?.name}
                  </p>
                  <p className="mt-1.5 text-sm font-medium leading-snug text-ink">
                    {s.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {s.description}
                  </p>
                </Link>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted">
            Prefer receipts over writing?{" "}
            <Link
              href="/leaderboard"
              className="focus-ring rounded-(--radius-tag) text-accent hover:underline"
            >
              See the live forward-test records →
            </Link>
          </p>
        </section>

        <p className="mt-10 border-t border-hairline pt-5 text-caption leading-relaxed text-faint">
          {DISCLAIMER}
        </p>
      </div>
    </main>
  );
}
