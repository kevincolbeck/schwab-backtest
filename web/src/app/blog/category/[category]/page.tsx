import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SectionShell from "@/components/SectionShell";
import Card from "@/components/ui/Card";
import { BLOG_CATEGORIES, categoryBySlug, postsInCategory } from "@/lib/blog";

/* Category hub pages (spec §P1-1: "/blog index → category hubs"). */

export const dynamicParams = false;

export function generateStaticParams() {
  return BLOG_CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const hub = categoryBySlug(category);
  if (!hub) return {};
  return {
    title: `${hub.name} — Chat·Backtest blog`,
    description: hub.tagline,
  };
}

export default async function BlogCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const hub = categoryBySlug(category);
  if (!hub) notFound();
  const posts = postsInCategory(hub.slug);

  return (
    <main className="w-full">
      <SectionShell
        headingAs="h1"
        hero
        tight
        eyebrow={`The Blog · ${hub.name}`}
        title={hub.name}
        sub={
          <>
            {hub.tagline}{" "}
            <Link
              href="/blog"
              className="focus-ring rounded-(--radius-tag) text-accent hover:underline"
            >
              ← All articles
            </Link>
          </>
        }
      >
        {posts.length === 0 ? (
          <Card pad="sm" className="text-sm text-muted">
            First articles in this category are in the pipeline —{" "}
            <Link
              href="/blog"
              className="focus-ring rounded-(--radius-tag) text-accent hover:underline"
            >
              browse the rest of the blog
            </Link>{" "}
            meanwhile.
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Card key={post.slug} pad="none" className="card-hover">
                <Link
                  href={`/blog/${post.slug}`}
                  className="focus-ring flex h-full flex-col p-5"
                >
                  <h2 className="text-sm font-medium leading-snug text-ink">
                    {post.title}
                  </h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                    {post.description}
                  </p>
                  <p className="tnum mt-4 text-caption text-faint">
                    {post.publishedAt} · {post.readingMinutes} min read
                  </p>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </SectionShell>
    </main>
  );
}
