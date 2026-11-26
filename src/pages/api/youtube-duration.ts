import type { APIRoute } from 'astro';

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const FETCH_TIMEOUT_MS = 15000;

function parseISO8601Duration(iso: string): number {
  if (!iso) return 0;
  const m = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const days = parseInt(m[1] || '0', 10);
  const hours = parseInt(m[2] || '0', 10);
  const minutes = parseInt(m[3] || '0', 10);
  const seconds = parseInt(m[4] || '0', 10);
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

/**
 * Extract lengthSeconds from ytInitialPlayerResponse JSON embedded in the watch page.
 * Falls back to a direct regex over the raw HTML if JSON parsing fails.
 */
function extractLengthSeconds(html: string): number | null {
  const jsonMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.*?\});\s*var\s/ms);
  let jsonOk = false;
  if (jsonMatch?.[1]) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      const lengthSeconds = data?.videoDetails?.lengthSeconds;
      if (lengthSeconds != null && String(lengthSeconds).trim() !== '') {
        const value = Number(lengthSeconds);
        if (Number.isFinite(value) && value > 0) {
          return value;
        }
      }
      jsonOk = true;
    } catch {
      jsonOk = true;
    }
  }

  if (!jsonOk) {
    const direct = html.match(/"lengthSeconds"\s*:\s*(\d+)/);
    if (direct) {
      const value = parseInt(direct[1], 10);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }

  return null;
}

/**
 * Extract ISO 8601 duration from watch page metadata:
 * <meta itemprop="duration" content="PT1H2M3S"> and the microformat duration.
 */
function extractIsoDuration(html: string): number | null {
  const meta = html.match(/<meta[^>]+itemprop\s*=\s*["']duration["'][^>]+content\s*=\s*["']([^"']+)["']/i);
  if (meta?.[1]) {
    const value = parseISO8601Duration(meta[1]);
    if (value > 0) return value;
  }

  const microMatch = html.match(/"duration"\s*:\s*"(PT\d+(?:[HMS]\d+)*)"/);
  if (microMatch?.[1]) {
    const value = parseISO8601Duration(microMatch[1]);
    if (value > 0) return value;
  }

  return null;
}

function extractTitle(html: string): string {
  if (!html) return 'YouTube Video';
  const m =
    html.match(/<meta[^>]+property\s*=\s*["']og:title["'][^>]+content\s*=\s*["']([^"']+)["']/i) ||
    html.match(/<title>([^<]+)<\/title>/i);
  if (m) return m[1].replace(/\s*-\s*YouTube\s*$/i, '').trim();
  return 'YouTube Video';
}

async function fetchWithTimeout(input: string, signal: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, {
      signal: signal.aborted ? undefined : controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
  } finally {
    if (!signal.aborted) clearTimeout(timeout);
  }
}

export const GET: APIRoute = async ({ url }) => {
  const videoId = url.searchParams.get('v')?.trim();
  if (!videoId || !YOUTUBE_ID_RE.test(videoId)) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid YouTube video ID' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const abort = new AbortController();

  try {
    let html = '';
    let fetchFailed = false;

    try {
      const res = await fetchWithTimeout(watchUrl, abort.signal);
      if (!res.ok) {
        fetchFailed = true;
      } else {
        html = await res.text();
      }
    } catch {
      fetchFailed = true;
    }

    if (!fetchFailed && html) {
      // 1. lengthSeconds in ytInitialPlayerResponse (player/initial JSON)
      const fromJson = extractLengthSeconds(html);
      if (fromJson != null && fromJson > 0) {
        return new Response(
          JSON.stringify({ videoId, title: extractTitle(html) || 'YouTube Video', durationSeconds: fromJson }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 2. ISO 8601 duration metadata (PT#H#M#S)
      const fromIso = extractIsoDuration(html);
      if (fromIso != null && fromIso > 0) {
        return new Response(
          JSON.stringify({ videoId, title: extractTitle(html) || 'YouTube Video', durationSeconds: fromIso }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Page fetched but no duration found; try oEmbed for the title at least.
      try {
        const oembedRes = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
          { signal: abort.signal, headers: { 'User-Agent': USER_AGENT } }
        );
        if (oembedRes.ok) {
          const oembed = await oembedRes.json();
          return new Response(
            JSON.stringify({ videoId, title: oembed.title || 'YouTube Video', durationSeconds: 0 }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } catch {
        /* ignore */
      }

      return new Response(
        JSON.stringify({ videoId, title: 'YouTube Video', durationSeconds: 0, error: 'Duration not found' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Watch page unavailable — fall back to oEmbed for title only.
    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
        { signal: abort.signal, headers: { 'User-Agent': USER_AGENT } }
      );
      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        return new Response(
          JSON.stringify({ videoId, title: oembed.title || 'YouTube Video', durationSeconds: 0 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } catch {
      /* ignore */
    }

    return new Response(
      JSON.stringify({ videoId, error: 'Unable to fetch video info from YouTube' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    abort.abort();
  }
};
