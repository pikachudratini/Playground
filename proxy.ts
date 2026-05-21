import { NextResponse, type NextRequest } from "next/server";

// Give every funnel visitor a stable id. The id is forwarded to the page via a
// request header (so the first render already has it) and persisted as a cookie.
export function proxy(req: NextRequest): NextResponse {
  const existing = req.cookies.get("fig_vid")?.value;
  const vid = existing ?? `vis_${crypto.randomUUID()}`;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-fig-visitor", vid);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  if (!existing) {
    res.cookies.set("fig_vid", vid, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  return res;
}

export const config = {
  matcher: "/f/:path*",
};
