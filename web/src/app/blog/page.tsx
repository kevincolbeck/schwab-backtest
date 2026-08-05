import type { Metadata } from "next";
import Link from "next/link";
import SectionShell from "@/components/SectionShell";
import Card from "@/components/ui/Card";
import { BLOG_CATEGORIES, postsInCategory } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog — strategies tested, receipts attached — Chat·Backtest",
  description:
    "Famous trading strategies run through a real backtesting engine, honest methodology guides, and lessons from a public forward-test ledger.",
};

export default function BlogIndexPage() {
  return (
    <main className="w-full">
      <SectionShell
        headingAs="h1"
        hero
        tight
        eyebrow="The Blog · Tested, not told"
        title="Strategies tested, receipts attached"
        sub={
          <>
            Every performance number in these articles renders live from our
            backtesting engine — never typed into the prose — and the losing
            tests are published next to the winning ones. Research and
            education, not financial advice.
          </>
        }
      >
        <div className="space-y-14">
          {BLOG_CATEGORIES.map((category) => {
            const posts = postsInCategory(category.slug);
            return (
              <section key={category.slug} aria-labelledby={`hub-${category.slug}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h2 id={`hub-${category.slug}`} className="text-xl font-medium text-ink">
                      <Link
                        href={`/blog/category/${category.slug}`}
                        className="focus-ring rounded-(--radius-tag) hover:text-accent"
                      >
                        {category.name}
                      </Link>
                    </h2>
                    <p className="mt-1.5 max-w-prose text-sm text-muted">
                      {category.tagline}
                    </p>
                  </div>
                  <Link
                    href={`/blog/category/${category.slug}`}
                    className="focus-ring rounded-(--radius-tag) text-sm text-accent hover:underline"
                  >
                    All {category.name} →
                  </Link>
                </div>
                {posts.length === 0 ? (
                  <Card pad="sm" className="mt-5 text-sm text-muted">
                    First articles in this category are in the pipeline. Until
                    then, the raw material lives on{" "}
                    <Link
                      href="/markets"
                      className="focus-ring rounded-(--radius-tag) text-accent hover:underline"
                    >
                      the markets pages
                    </Link>
                    .
                  </Card>
                ) : (
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {posts.map((post) => (
                      <Card key={post.slug} pad="none" className="card-hover">
                        <Link
                          href={`/blog/${post.slug}`}
                          className="focus-ring flex h-full flex-col p-5"
                        >
                          <h3 className="text-sm font-medium leading-snug text-ink">
                            {post.title}
                          </h3>
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
              </section>
            );
          })}
        </div>
      </SectionShell>
    </main>
  );
}
