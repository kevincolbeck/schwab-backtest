"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { type NewsArticle, relTime, relatedTickers } from "./types";

const REFRESH_MS = 10 * 60 * 1000;
const THUMB_CLASS = "h-36 w-full"; // fixed height everywhere -> zero layout shift

function Thumb({ src, headline }: { src: string | null; headline: string }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary third-party news hosts; native lazy loading is the requirement
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className={`${THUMB_CLASS} border-b border-hairline object-cover`}
      />
    );
  }
  // Branded placeholder: dark panel + the mono wordmark (real thumbnails only
  // when the source provides one — nothing fake).
  return (
    <div
      aria-hidden
      title={headline}
      className={`${THUMB_CLASS} flex items-center justify-center border-b border-hairline bg-panel-2`}
    >
      <span className="font-mono text-sm tracking-tight text-faint">
        chat·backtest
      </span>
    </div>
  );
}

function NewsCard({ article }: { article: NewsArticle }) {
  const tickers = relatedTickers(article.related);
  return (
    <Card pad="none" interactive className="relative flex flex-col overflow-hidden">
      <Thumb src={article.image} headline={article.headline} />
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-sm font-medium text-ink">
          {/* Stretched link: the whole card opens the source article in a new
              tab; ticker tags sit above it on their own z-plane. */}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring rounded-(--radius-tag) after:absolute after:inset-0 after:content-['']"
          >
            {article.headline}
          </a>
        </h3>
        <p className="tnum mt-1.5 text-caption text-faint">
          {article.source ?? "—"}
          {article.datetime ? (
            // Client clock vs SSR clock can differ by a minute — text-only drift.
            <span suppressHydrationWarning> · {relTime(article.datetime)}</span>
          ) : null}
        </p>
        {tickers.length > 0 && (
          <div className="relative z-10 mt-auto flex flex-wrap gap-1 pt-3">
            {tickers.map((t) => (
              <Link
                key={t}
                href={`/stocks/${encodeURIComponent(t)}`}
                className="focus-ring tnum rounded-(--radius-tag) border border-hairline bg-panel-2 px-1.5 py-0.5 text-caption text-muted transition-colors duration-(--dur-micro) hover:border-hairline-strong hover:text-ink"
              >
                {t}
              </Link>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

/** Latest-market-news card grid. Server-rendered with the initial articles,
 *  then silently refetched every 10 minutes — only while the tab is visible,
 *  and stale-checked when the tab comes back. Fixed thumb heights keep the
 *  refresh free of layout shift. */
export default function NewsGrid({
  initialConfigured,
  initialArticles,
}: {
  initialConfigured: boolean;
  initialArticles: NewsArticle[];
}) {
  const [configured, setConfigured] = useState(initialConfigured);
  const [articles, setArticles] = useState<NewsArticle[]>(initialArticles);
  const lastFetch = useRef(0);

  useEffect(() => {
    // The server-rendered articles count as fresh at mount.
    if (lastFetch.current === 0) lastFetch.current = Date.now();
    let stopped = false;
    const load = async () => {
      lastFetch.current = Date.now();
      try {
        const res = await fetch("/api/markets/news");
        if (!res.ok) return; // keep showing the last good articles
        const body = (await res.json()) as {
          configured?: boolean;
          articles?: NewsArticle[];
        };
        if (stopped || !Array.isArray(body.articles)) return;
        setConfigured(body.configured ?? false);
        // Never swap real headlines for an empty hiccup payload.
        if (body.articles.length > 0 || body.configured === false) {
          setArticles(body.articles);
        }
      } catch {
        /* silent — the current cards stay up */
      }
    };
    const tick = () => {
      if (document.visibilityState === "visible") load();
    };
    const interval = setInterval(tick, REFRESH_MS);
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastFetch.current > REFRESH_MS
      ) {
        load();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!configured) {
    return (
      <Card pad="sm" className="border-dashed text-sm text-muted">
        Headlines warming up — market news will appear here shortly.
      </Card>
    );
  }
  if (articles.length === 0) {
    return (
      <Card pad="sm" className="border-dashed text-sm text-muted">
        No headlines right now — check back after the next refresh.
      </Card>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <NewsCard key={article.url} article={article} />
      ))}
    </div>
  );
}
