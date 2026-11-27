import type { APIRoute } from 'astro';

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
];

const FETCH_TIMEOUT_MS = 20000;

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

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

function extractLengthSeconds(html: string): number | null {
  const results: number[] = [];

  // ytInitialPlayerResponse JSON
  const jsonPatterns = [
    /ytInitialPlayerResponse\s*=\s*(\{.*?\});\s*var\s/ms,
    /window\["ytInitialPlayerResponse"\]\s*=\s*(\{.*?\});\s*var\s/ms,
  ];
  for (const re of jsonPatterns) {
    const m = html.match(re);
    if (m?.[1]) {
      try {
        const data = JSON.parse(m[1]);
        const ls = data?.videoDetails?.lengthSeconds;
        if (ls != null && String(ls).trim() !== '') {
          const v = Number(ls);
          if (Number.isFinite(v) && v > 0) results.push(v);
        }
      } catch {}
    }
  }

  // Direct regex on raw HTML
  const direct = html.match(/"lengthSeconds"\s*:\s*(\d+)/g);
  if (direct) {
    for (const d of direct) {
      const mm = d.match(/"lengthSeconds"\s*:\s*(\d+)/);
      if (mm) {
        const v = parseInt(mm[1], 10);
        if (Number.isFinite(v) && v > 0) results.push(v);
      }
    }
  }

  // JSON inside <script type="application/json">
  const scriptJson = html.match(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/g);
  if (scriptJson) {
    for (const s of scriptJson) {
      try {
        const data = JSON.parse(s);
        const walk = (obj: any): number | null => {
          if (obj && typeof obj === 'object') {
            if (obj.lengthSeconds != null) {
              const v = Number(obj.lengthSeconds);
              if (Number.isFinite(v) && v > 0) return v;
            }
            for (const k of Object.keys(obj)) {
              const r = walk(obj[k]);
              if (r) return r;
            }
          }
          return null;
        };
        const v = walk(data);
        if (v) results.push(v);
      } catch {}
    }
  }

  const positive = results.filter((v) => v > 0);
  return positive.length > 0 ? Math.min(...positive) : null;
}

function extractIsoDuration(html: string): number | null {
  const results: number[] = [];

  const meta = html.match(/<meta[^>]+itemprop\s*=\s*["']duration["'][^>]+content\s*=\s*["']([^"']+)["']/i);
  if (meta?.[1]) {
    const v = parseISO8601Duration(meta[1]);
    if (v > 0) results.push(v);
  }

  const ogDur = html.match(/<meta[^>]+property\s*=\s*["']og:video:duration["'][^>]+content\s*=\s*["'](\d+)["']/i);
  if (ogDur?.[1]) {
    const v = parseInt(ogDur[1], 10);
    if (Number.isFinite(v) && v > 0) results.push(v);
  }

  const micro = html.match(/"duration"\s*:\s*"(PT\d+(?:[HMS]\d+)*)"/g);
  if (micro) {
    for (const m of micro) {
      const mm = m.match(/"duration"\s*:\s*"(PT\d+(?:[HMS]\d+)*)"/);
      if (mm?.[1]) {
        const v = parseISO8601Duration(mm[1]);
        if (v > 0) results.push(v);
      }
    }
  }

  const positive = results.filter((v) => v > 0);
  return positive.length > 0 ? Math.min(...positive) : null;
}

function extractTitle(html: string): string {
  if (!html) return 'YouTube Video';
  const patterns = [
    /<meta[^>]+property\s*=\s*["']og:title["'][^>]+content\s*=\s*["']([^"']+)["']/i,
    /<meta[^>]+name\s*=\s*["']title["'][^>]+content\s*=\s*["']([^"']+)["']/i,
    /<title>([^<]+)<\/title>/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1].replace(/\s*-\s*YouTube\s*$/i, '').trim();
  }
  return 'YouTube Video';
}

async function fetchWithTimeout(
  input: string,
  opts: { signal?: AbortSignal; ua?: string; method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, {
      signal: opts.signal ?? controller.signal,
      method: opts.method ?? 'GET',
      headers: {
        'User-Agent': opts.ua ?? randomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        ...opts.headers,
      },
      body: opts.body,
    });
  } finally {
    if (!opts.signal) clearTimeout(timeout);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function saveToKV(platform: any, videoId: string, title: string, durationSeconds: number) {
  try {
    const kv = platform?.env?.SESSION;
    if (kv) {
      await kv.put(`yt-duration:${videoId}`, JSON.stringify({ title, durationSeconds }), { expirationTtl: 86400 * 7 });
    }
  } catch {
    /* KV unavailable, skip caching */
  }
}

/** Try the youtubei/v1/player API with different client variants. */
async function tryYouTubeiAPI(videoId: string): Promise<number | null> {
  const clients = [
    { clientName: 'WEB', clientVersion: '2.20240723.01.00', clientNameValue: '1' },
    { clientName: 'WEB', clientVersion: '2.20240723.01.00', clientNameValue: '1' },
    { clientName: 'IOS', clientVersion: '19.09.3', clientNameValue: '5' },
    { clientName: 'ANDROID', clientVersion: '19.09.3', clientNameValue: '7' },
    { clientName: 'TVHTML5', clientVersion: '7.20240723.01.0', clientNameValue: '10' },
  ];

  for (const client of clients) {
    try {
      const res = await fetch(
        `https://www.youtube.com/youtubei/v1/player?videoId=${videoId}&key=`,
        {
          method: 'POST',
          headers: {
            'User-Agent': randomUA(),
            'Content-Type': 'application/json',
            'X-YouTube-Client-Name': client.clientNameValue,
            'X-YouTube-Client-Version': client.clientVersion,
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            videoId,
            context: {
              client: {
                clientName: client.clientName,
                clientVersion: client.clientVersion,
                clientScreen: 'WATCH',
              },
            },
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const ls =
          data?.videoDetails?.lengthSeconds ??
          data?.streamingData?.adaptiveFormats?.[0]?.approxDurationMs;
        if (ls) {
          const durationSeconds =
            typeof ls === 'string' || typeof ls === 'number'
              ? Math.round(Number(ls) / 1000)
              : 0;
          if (durationSeconds > 0) return durationSeconds;
        }
      }
    } catch {}
    await sleep(800);
  }
  return null;
}

export const GET: APIRoute = async ({ url, platform }) => {
  const videoId = url.searchParams.get('v')?.trim();
  if (!videoId || !YOUTUBE_ID_RE.test(videoId)) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid YouTube video ID' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Strategy 0: KV cache lookup
  try {
    const kv = (platform as any)?.env?.SESSION;
    if (kv) {
      const cached = await kv.get(`yt-duration:${videoId}`);
      if (cached) {
        const data = JSON.parse(cached);
        return new Response(
          JSON.stringify({ videoId, title: data.title || 'YouTube Video', durationSeconds: data.durationSeconds, cached: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  } catch {
    /* KV unavailable, proceed without cache */
  }

  const urls = [
    `https://www.youtube.com/watch?v=${videoId}`,
    `https://m.youtube.com/watch?v=${videoId}`,
    `https://www.youtube.com/embed/${videoId}`,
    `https://www.youtube-nocookie.com/embed/${videoId}`,
  ];

  let lastError = '';

  // Strategy 1: Watch page HTML (with retries)
  for (const watchUrl of urls) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetchWithTimeout(watchUrl);
        if (!res.ok) {
          lastError = `HTTP ${res.status} for ${watchUrl}`;
          if (attempt < 2) await sleep(3000);
          continue;
        }
        const html = await res.text();

        const fromJson = extractLengthSeconds(html);
        if (fromJson != null && fromJson > 0) {
          await saveToKV(platform, videoId, extractTitle(html) || 'YouTube Video', fromJson);
          return new Response(
            JSON.stringify({ videoId, title: extractTitle(html) || 'YouTube Video', durationSeconds: fromJson }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const fromIso = extractIsoDuration(html);
        if (fromIso != null && fromIso > 0) {
          await saveToKV(platform, videoId, extractTitle(html) || 'YouTube Video', fromIso);
          return new Response(
            JSON.stringify({ videoId, title: extractTitle(html) || 'YouTube Video', durationSeconds: fromIso }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        break; // HTML fetched but no duration — try next URL
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt < 2) await sleep(3000);
        continue;
      }
    }
  }

  // Strategy 2: youtubei/v1/player API
  const ytDuration = await tryYouTubeiAPI(videoId);
  if (ytDuration != null && ytDuration > 0) {
    await saveToKV(platform, videoId, 'YouTube Video', ytDuration);
    return new Response(
      JSON.stringify({ videoId, title: 'YouTube Video', durationSeconds: ytDuration }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Strategy 3: oEmbed for title at least
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const oembedRes = await fetchWithTimeout(oembedUrl);
    if (oembedRes.ok) {
      const oembed = await oembedRes.json();
      return new Response(
        JSON.stringify({ videoId, title: oembed.title || 'YouTube Video', durationSeconds: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch {}

  // Try noembed.com
  try {
    const noembedUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`;
    const noembedRes = await fetchWithTimeout(noembedUrl);
    if (noembedRes.ok) {
      const data = await noembedRes.json();
      return new Response(
        JSON.stringify({ videoId, title: data.title || 'YouTube Video', durationSeconds: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch {}

  return new Response(
    JSON.stringify({ videoId, title: 'YouTube Video', durationSeconds: 0, error: lastError || 'Duration not found' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
