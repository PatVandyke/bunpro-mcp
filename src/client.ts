/**
 * Bunpro API client
 *
 * Supports two auth modes:
 *   - Frontend token (full access) — set BUNPRO_API_TOKEN
 *   - Legacy API key (limited: study_queue + recent_items only) — set BUNPRO_API_KEY
 *
 * The frontend token is the `frontend_api_token` cookie from bunpro.jp
 * (DevTools → Application → Cookies). It expires roughly monthly.
 *
 * Token resolution is done PER CALL: the live value is read from
 * ~/.claude-work/.claude.json (the bunpro-mcp env block) on each request,
 * falling back to the spawn-time env token. This means refreshing the token in
 * that file is picked up immediately — no Claude Code restart needed. On a 401
 * the file is re-read once and the request retried, so a mid-session refresh
 * auto-recovers.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const FRONTEND_BASE = "https://api.bunpro.jp/api/frontend";
const LEGACY_BASE = "https://bunpro.jp/api/user";
const TOKEN_FILE = join(homedir(), ".claude-work", ".claude.json");
const TOKEN_TTL_MS = 30_000;

function deepFindToken(obj: unknown): string | undefined {
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === "BUNPRO_API_TOKEN" && typeof v === "string" && v.length > 0) {
        return v;
      }
      const found = deepFindToken(v);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Read the current frontend token from ~/.claude-work/.claude.json.
 * Returns undefined if the file is missing/unparseable or the field is absent.
 */
export function readTokenFromFile(): string | undefined {
  try {
    return deepFindToken(JSON.parse(readFileSync(TOKEN_FILE, "utf8")));
  } catch {
    return undefined;
  }
}

const TOKEN_EXPIRED_MSG =
  "Bunpro token expired (401 AUTH_USER_DENIED). Refresh it: bunpro.jp → DevTools → " +
  "Application → Cookies → frontend_api_token, then update BUNPRO_API_TOKEN in " +
  "~/.claude-work/.claude.json. No Claude Code restart needed — the token is re-read per call.";

interface SearchOptions {
  grammar?: boolean;
  vocab?: boolean;
  limit?: number;
}

function compactAttrs(a: Record<string, unknown> | undefined) {
  if (!a) return a;
  return {
    id: a.id,
    title: a.title,
    kana: a.kana,
    furigana: a.furigana,
    slug: a.slug,
    level: a.level ?? a.jlpt_level,
    meaning: a.meaning,
    type: a.type_pascal,
  };
}

/**
 * Strip the search payload down to the fields callers actually use and cap each
 * section to `limit`. Raw search responses embed jmdict_data, coverage_vocab_ids
 * and HTML structure blocks — a single query (e.g. べき) can exceed 240 KB and
 * kill the stdio transport. Truncation is reported, never silent.
 */
function trimSearch(raw: any, limit: number) {
  const pick = (section: any) =>
    (section?.data ?? []).slice(0, limit).map((d: any) => compactAttrs(d?.attributes));
  const gTotal = raw?.grammar_points?.data?.length ?? 0;
  const vTotal = raw?.vocabs?.data?.length ?? 0;
  return {
    grammar_points: pick(raw?.grammar_points),
    vocabs: pick(raw?.vocabs),
    truncated: {
      grammar: gTotal > limit ? `${limit}/${gTotal}` : false,
      vocab: vTotal > limit ? `${limit}/${vTotal}` : false,
    },
  };
}

export class BunproClient {
  private envToken: string | undefined;
  private legacyKey: string | undefined;
  private cachedToken: string | undefined;
  private cachedAt = 0;

  constructor(frontendToken?: string, legacyKey?: string) {
    this.envToken = frontendToken;
    this.legacyKey = legacyKey;
    // No hard failure here: the frontend token is resolved per call (file first),
    // so the server starts as long as the file or env will provide one.
  }

  /**
   * Resolve the frontend token fresh: file (refreshable, no restart) → env fallback.
   * Cached for TOKEN_TTL_MS; pass force=true to bypass (used on 401 recovery).
   */
  private resolveFrontendToken(force = false): string | undefined {
    const now = Date.now();
    if (!force && this.cachedToken && now - this.cachedAt < TOKEN_TTL_MS) {
      return this.cachedToken;
    }
    this.cachedToken = readTokenFromFile() ?? this.envToken;
    this.cachedAt = now;
    return this.cachedToken;
  }

  private async frontend<T>(
    path: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<T> {
    const token = this.resolveFrontendToken(isRetry);
    if (!token) {
      throw new Error(
        "No Bunpro frontend token found. Set BUNPRO_API_TOKEN (the frontend_api_token " +
          "cookie from bunpro.jp) in the bunpro-mcp env block of ~/.claude-work/.claude.json."
      );
    }
    const url = `${FRONTEND_BASE}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options.headers ?? {}),
      },
    });
    if (res.status === 401) {
      // Token may have just been refreshed in the file; re-read once and retry.
      if (!isRetry && this.resolveFrontendToken(true) !== token) {
        return this.frontend<T>(path, options, true);
      }
      throw new Error(TOKEN_EXPIRED_MSG);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Bunpro API error ${res.status} for ${url}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  private async legacy<T>(path: string): Promise<T> {
    if (!this.legacyKey) {
      throw new Error("BUNPRO_API_KEY is not set.");
    }
    const url = `${LEGACY_BASE}/${this.legacyKey}${path}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Bunpro legacy API error ${res.status} for ${url}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  // ── User ──────────────────────────────────────────────────────────────────

  getUser() {
    return this.frontend("/user");
  }

  getDueCount() {
    return this.frontend("/user/due");
  }

  getQueue() {
    return this.frontend("/user/queue");
  }

  // ── Reviews ───────────────────────────────────────────────────────────────

  getReviews(page = 1, perPage = 25) {
    return this.frontend(`/reviews?page=${page}&per_page=${perPage}`);
  }

  // ── Statistics ────────────────────────────────────────────────────────────

  getBaseStats() {
    return this.frontend("/user_stats/base_stats");
  }

  getJlptProgress() {
    return this.frontend("/user_stats/jlpt_progress_mixed");
  }

  getSrsOverview() {
    return this.frontend("/user_stats/srs_level_overview");
  }

  getSrsLevelDetails(level: number, reviewableType: string, page = 1) {
    return this.frontend(
      `/user_stats/srs_level_details?level=${level}&reviewable_type=${reviewableType}&page=${page}`
    );
  }

  getGhostDetails(reviewableType: string) {
    return this.frontend(
      `/user_stats/srs_ghost_level_details?reviewable_type=${reviewableType}`
    );
  }

  getForecastDaily() {
    return this.frontend("/user_stats/forecast_daily");
  }

  getForecastHourly() {
    return this.frontend("/user_stats/forecast_hourly");
  }

  getReviewActivity() {
    return this.frontend("/user_stats/review_activity");
  }

  // ── Review History ────────────────────────────────────────────────────────

  getLastSession() {
    return this.frontend("/review_histories/last_session");
  }

  getLast24Hours() {
    return this.frontend("/review_histories/last_24_hours");
  }

  // ── Content ───────────────────────────────────────────────────────────────

  getItem(slugOrId: string) {
    return this.frontend(`/reviewables/vocab/${encodeURIComponent(slugOrId)}`);
  }

  getItemNotes(slugOrId: string) {
    return this.frontend(
      `/reviewables/vocab/${encodeURIComponent(slugOrId)}/notes`
    );
  }

  async search(query: string, opts: SearchOptions = {}) {
    const grammar = opts.grammar ?? true;
    const vocab = opts.vocab ?? true;
    const limit = opts.limit ?? 20;
    const raw = await this.frontend("/search/reviewables_v1_1", {
      method: "POST",
      body: JSON.stringify({
        query,
        options: {
          include_reviews: true,
          include_bookmarks: true,
          include_notes: true,
          only_bookmarks: false,
        },
        is_searching_grammar: grammar,
        is_searching_vocab: vocab,
      }),
    });
    return trimSearch(raw, limit);
  }

  // ── Review management ────────────────────────────────────────────────────

  updateReviewsViaActionType(body: {
    action_type: "add" | "remove";
    deck_id?: number | null;
    reviewables: Array<[string, number]>;
  }) {
    return this.frontend("/reviews/update_via_action_type", {
      method: "PATCH",
      body: JSON.stringify({ deck_id: null, ...body }),
    });
  }

  // ── Bookmarks ─────────────────────────────────────────────────────────────

  addBookmark(body: Record<string, unknown>) {
    return this.frontend("/bookmarks", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  removeBookmark(bookmarkId: string | number) {
    return this.frontend(`/bookmarks/${bookmarkId}`, { method: "DELETE" });
  }

  // ── Legacy (deprecated but functional) ───────────────────────────────────

  getLegacyStudyQueue() {
    return this.legacy("/study_queue");
  }

  getLegacyRecentItems(limit = 10) {
    const clamped = Math.min(Math.max(limit, 1), 50);
    return this.legacy(`/recent_items/${clamped}`);
  }
}
