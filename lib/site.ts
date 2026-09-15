// Main RankEdges brand site. Contest cards and header CTAs on the contest
// menu link out to this domain. Change here if the public contest path differs.
export const MAIN_SITE_URL = "https://rankedges.com"

// Where a contest opens on the main site. Adjust the path if the brand site
// exposes contests under a different route.
export function mainSiteContestUrl(slug: string) {
  return `${MAIN_SITE_URL}/contests/${slug}`
}
