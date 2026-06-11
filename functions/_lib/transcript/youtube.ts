import type { TranscriptCue, TranscriptInput } from './types';
import { YOUTUBE_FETCH_TIMEOUT_MS } from './constants';

// ---------------------------------------------------------------------------
// YouTube transcript fetch — best-effort scrape of the public caption track.
//
// This works for: videos with auto-captions or manual captions enabled.
// This fails for: age-restricted, members-only, private videos, or videos
// where captions are disabled. Failures degrade gracefully — return null and
// let the user paste the transcript directly.
//
// Implementation notes:
// - YouTube embeds the caption track URL in `ytInitialPlayerResponse.captions`
//   on the watch page HTML. We scrape, regex-extract, then fetch the .vtt or
//   .xml caption file.
// - This is brittle by design — YouTube changes the markup periodically.
//   Mitigation: graceful failure plus paste-transcript fallback in the UI.
// ---------------------------------------------------------------------------

const YOUTUBE_VIDEO_ID_RE = /(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/;

export function extractVideoId(url: string): string | null {
  const match = url.match(YOUTUBE_VIDEO_ID_RE);
  return match ? match[1]! : null;
}

interface CaptionTrack {
  baseUrl:    string;
  languageCode: string;
}

// ---------------------------------------------------------------------------
// Scrape captions metadata from the YouTube watch page
// ---------------------------------------------------------------------------
async function fetchCaptionTracks(videoId: string): Promise<CaptionTrack[] | null> {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), YOUTUBE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TheWhetstoneBot/1.0)',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Extract the captions block from ytInitialPlayerResponse.
    // Pattern is brittle — YouTube changes it periodically; we degrade gracefully on failure.
    const playerResponseMatch = html.match(/var ytInitialPlayerResponse\s*=\s*({.+?});\s*var\s/s);
    if (!playerResponseMatch) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(playerResponseMatch[1]!);
    } catch {
      return null;
    }

    // Walk the structure safely
    const captions = (parsed as { captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: Array<{ baseUrl?: string; languageCode?: string }> } } })
      ?.captions
      ?.playerCaptionsTracklistRenderer
      ?.captionTracks;

    if (!Array.isArray(captions) || captions.length === 0) return null;

    return captions
      .filter((t): t is CaptionTrack => typeof t.baseUrl === 'string' && typeof t.languageCode === 'string')
      .map(t => ({ baseUrl: t.baseUrl, languageCode: t.languageCode }));
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Parse YouTube's XML caption format into TranscriptCue[]
// ---------------------------------------------------------------------------
const CUE_RE = /<text\s+start="([\d.]+)"\s+dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n as string, 10)));
}

function parseYouTubeXmlCaptions(xml: string): TranscriptCue[] {
  const cues: TranscriptCue[] = [];
  let m: RegExpExecArray | null;
  while ((m = CUE_RE.exec(xml)) !== null) {
    const startSec = parseFloat(m[1]!);
    const durSec   = parseFloat(m[2]!);
    const text     = decodeXmlEntities(m[3]!).replace(/\n/g, ' ').trim();
    if (text.length === 0) continue;
    cues.push({ startSec, endSec: startSec + durSec, text });
  }
  return cues;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchYouTubeTranscript(url: string): Promise<TranscriptInput | null> {
  const videoId = extractVideoId(url);
  if (!videoId) return null;

  const tracks = await fetchCaptionTracks(videoId);
  if (!tracks || tracks.length === 0) return null;

  // Prefer English if available, else first track.
  const track = tracks.find(t => t.languageCode.startsWith('en')) ?? tracks[0]!;

  // Fetch the caption XML
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), YOUTUBE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(track.baseUrl, { signal: controller.signal });
    if (!res.ok) return null;
    const xml = await res.text();
    const cues = parseYouTubeXmlCaptions(xml);
    if (cues.length === 0) return null;

    return {
      sourceType: 'youtube',
      sourceUrl:  url,
      title:      null,
      cues,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Build a paste-only input from a single text block (no timestamps).
// ---------------------------------------------------------------------------

export function fromPlainText(text: string, title?: string): TranscriptInput {
  return {
    sourceType: 'paste',
    sourceUrl:  null,
    title:      title ?? null,
    cues: [{ startSec: 0, endSec: 0, text: text.trim() }],
  };
}

// ---------------------------------------------------------------------------
// Build a paste input from SRT-formatted text (preserves timestamps).
// ---------------------------------------------------------------------------

const SRT_TIMESTAMP_RE = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/g;

function srtTimeToSec(ts: string): number {
  SRT_TIMESTAMP_RE.lastIndex = 0;
  const m = SRT_TIMESTAMP_RE.exec(ts);
  if (!m) return 0;
  return parseInt(m[1]!, 10) * 3600 + parseInt(m[2]!, 10) * 60 + parseInt(m[3]!, 10) + parseInt(m[4]!, 10) / 1000;
}

export function fromSrt(srt: string, title?: string): TranscriptInput | null {
  const blocks = srt.split(/\r?\n\r?\n+/).map(b => b.trim()).filter(Boolean);
  const cues: TranscriptCue[] = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    // First line: index. Second: timestamp range. Rest: text.
    const tsLine = lines.find(l => l.includes('-->'));
    if (!tsLine) continue;
    const [startTs, endTs] = tsLine.split('-->').map(s => s.trim());
    if (!startTs || !endTs) continue;
    const startSec = srtTimeToSec(startTs);
    const endSec   = srtTimeToSec(endTs);
    const textLines = lines.filter(l => !l.includes('-->') && !/^\d+$/.test(l.trim()));
    const text = textLines.join(' ').trim();
    if (text) cues.push({ startSec, endSec, text });
  }

  if (cues.length === 0) return null;
  return { sourceType: 'paste', sourceUrl: null, title: title ?? null, cues };
}

// ---------------------------------------------------------------------------
// Concatenate cues into a single transcript string for LLM input
// ---------------------------------------------------------------------------

export function cuesToText(cues: TranscriptCue[], includeTimestamps = false): string {
  if (!includeTimestamps) {
    return cues.map(c => c.text).join(' ');
  }
  return cues.map(c => {
    const mins = Math.floor(c.startSec / 60);
    const secs = Math.floor(c.startSec % 60).toString().padStart(2, '0');
    return `[${mins}:${secs}] ${c.text}`;
  }).join('\n');
}
