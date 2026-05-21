import type { Device, VisitorSignals } from "./types";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

function detectDevice(ua: string): Device {
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return "tablet";
  if (/Android(?!.*Mobile)/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) return "mobile";
  return "desktop";
}

function cleanReferrer(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return raw.slice(0, 120) || undefined;
  }
}

// Pull the marketing signals we can read for free from a request:
// UTM tags from the URL, referrer/device/language/country from headers.
export function extractSignals(
  headers: Headers,
  searchParams: SearchParams = {},
): VisitorSignals {
  const ua = headers.get("user-agent") ?? "";
  const country =
    headers.get("x-vercel-ip-country") ??
    headers.get("cf-ipcountry") ??
    headers.get("x-geo-country") ??
    undefined;
  const language = headers.get("accept-language")?.split(",")[0]?.trim();

  const signals: VisitorSignals = {
    device: detectDevice(ua),
    userAgent: ua.slice(0, 200) || undefined,
  };
  if (country && country !== "XX") signals.country = country;
  if (language) signals.language = language;

  const ref =
    first(searchParams.ref) ?? cleanReferrer(headers.get("referer"));
  if (ref) signals.referrer = ref;

  const utmSource = first(searchParams.utm_source);
  const utmMedium = first(searchParams.utm_medium);
  const utmCampaign = first(searchParams.utm_campaign);
  if (utmSource) signals.utmSource = utmSource;
  if (utmMedium) signals.utmMedium = utmMedium;
  if (utmCampaign) signals.utmCampaign = utmCampaign;

  return signals;
}

// A short human-readable description of where a visitor came from.
export function describeSignals(s: VisitorSignals): string {
  const parts: string[] = [];
  if (s.utmSource) {
    parts.push(
      `Arrived from a ${s.utmMedium ?? "marketing"} campaign on ${s.utmSource}` +
        (s.utmCampaign ? ` (campaign: ${s.utmCampaign})` : ""),
    );
  } else if (s.referrer) {
    parts.push(`Referred from ${s.referrer}`);
  } else {
    parts.push("Arrived directly (no referrer)");
  }
  parts.push(`on ${s.device}`);
  if (s.country) parts.push(`from ${s.country}`);
  if (s.language) parts.push(`language ${s.language}`);
  return parts.join(", ") + ".";
}
