/**
 * /campaigns/[slug] — human-readable slug route.
 *
 * Resolves a slug (e.g. "eco-friendly-water-purification") to its
 * campaign ID, then delegates to the existing campaign detail content.
 * Old /campaigns/[id] links continue to work because resolveCampaignSlug
 * falls back to raw-ID lookup.
 *
 * This route lives alongside /campaigns/[id]/page.tsx.  Next.js picks the
 * most-specific dynamic segment, so contract-ID paths still hit [id] when
 * pre-generated; slug paths are handled here at runtime.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BreadcrumbProvider } from "@/context/BreadcrumbContext";
import { CampaignDetailContent } from "@/app/[locale]/campaigns/[id]/CampaignDetailContent";
import { resolveCampaignSlug, getAllSlugs } from "@/lib/slugs";
import { fetchCampaign } from "@/lib/graphql/client";
import { APP_BASE_URL, DEFAULT_HERO_IMAGE } from "@/lib/constants";
import { ALL_CAMPAIGNS } from "@/lib/campaigns";

// ── Static generation ─────────────────────────────────────────────────────

export function generateStaticParams() {
  return getAllSlugs().map(({ slug }) => ({ slug }));
}

// ── SEO ───────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const campaignId = resolveCampaignSlug(slug);
  if (!campaignId) return { title: "Campaign — Fund-My-Cause" };

  // Try soroban first, fall back to mock data
  try {
    const c = await fetchCampaign(campaignId);
    const description = c.description.slice(0, 160);
    const url = `${APP_BASE_URL}/campaigns/${slug}`;
    return {
      title: `${c.title} — Fund-My-Cause`,
      description,
      alternates: { canonical: url },
      openGraph: {
        title: c.title,
        description,
        url,
        siteName: "Fund-My-Cause",
        images: [
          { url: DEFAULT_HERO_IMAGE, width: 1200, height: 630, alt: c.title },
        ],
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: c.title,
        description,
        images: [DEFAULT_HERO_IMAGE],
      },
    };
  } catch {
    const mock = ALL_CAMPAIGNS.find((c) => c.id === campaignId);
    if (mock) {
      return {
        title: `${mock.title} — Fund-My-Cause`,
        description: mock.description.slice(0, 160),
      };
    }
    return { title: "Campaign — Fund-My-Cause" };
  }
}

// ── Page ──────────────────────────────────────────────────────────────────

export default async function CampaignSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Resolve slug → campaign ID (also handles raw IDs for backward compat)
  const campaignId = resolveCampaignSlug(slug);
  if (!campaignId) notFound();

  // Resolve campaign title for breadcrumb (best-effort, no hard failure)
  let campaignTitle = slug;
  try {
    const c = await fetchCampaign(campaignId!);
    campaignTitle = c.title;
  } catch {
    const mock = ALL_CAMPAIGNS.find((c) => c.id === campaignId);
    if (mock) campaignTitle = mock.title;
  }

  return (
    <BreadcrumbProvider>
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
        <Navbar />
        <div className="max-w-3xl mx-auto px-6 pt-6">
          <Breadcrumb
            crumbs={[
              { label: "Campaigns", href: "/campaigns" },
              { label: campaignTitle },
            ]}
            className="text-gray-500"
          />
        </div>
        {/* Reuse the same rich detail component as the [id] route */}
        <CampaignDetailContent contractId={campaignId!} />
      </main>
    </BreadcrumbProvider>
  );
}
