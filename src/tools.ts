import { z } from "zod";
import { BunproClient } from "./client.js";

export interface Tool {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (client: BunproClient, args: unknown) => Promise<unknown>;
}

export const tools: Tool[] = [
  // ── User ──────────────────────────────────────────────────────────────────
  {
    name: "get_user",
    description: "Get the current Bunpro user profile (level, title, settings).",
    inputSchema: z.object({}),
    handler: (client) => client.getUser(),
  },
  {
    name: "get_due_count",
    description: "Get the number of reviews currently due in Bunpro.",
    inputSchema: z.object({}),
    handler: (client) => client.getDueCount(),
  },
  {
    name: "get_queue",
    description: "Get the full current review queue from Bunpro.",
    inputSchema: z.object({}),
    handler: (client) => client.getQueue(),
  },

  // ── Reviews ───────────────────────────────────────────────────────────────
  {
    name: "get_reviews",
    description: "List reviews with pagination.",
    inputSchema: z.object({
      page: z.number().int().min(1).default(1).describe("Page number"),
      per_page: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(25)
        .describe("Results per page"),
    }),
    handler: (client, args) => {
      const { page, per_page } = args as { page: number; per_page: number };
      return client.getReviews(page, per_page);
    },
  },

  // ── Statistics ────────────────────────────────────────────────────────────
  {
    name: "get_base_stats",
    description:
      "Get overall Bunpro study statistics (total grammar points, reviews, streaks, etc.).",
    inputSchema: z.object({}),
    handler: (client) => client.getBaseStats(),
  },
  {
    name: "get_jlpt_progress",
    description:
      "Get grammar/vocab progress broken down by JLPT level (N1–N5).",
    inputSchema: z.object({}),
    handler: (client) => client.getJlptProgress(),
  },
  {
    name: "get_srs_overview",
    description:
      "Get the SRS level distribution — how many items are at each SRS tier.",
    inputSchema: z.object({}),
    handler: (client) => client.getSrsOverview(),
  },
  {
    name: "get_srs_level_details",
    description: "Get items at a specific SRS level with pagination.",
    inputSchema: z.object({
      level: z.number().int().min(1).max(10).describe("SRS level (1–10)"),
      reviewable_type: z
        .enum(["GrammarPoint", "Vocabulary"])
        .describe("Type of reviewable item"),
      page: z.number().int().min(1).default(1),
    }),
    handler: (client, args) => {
      const { level, reviewable_type, page } = args as {
        level: number;
        reviewable_type: string;
        page: number;
      };
      return client.getSrsLevelDetails(level, reviewable_type, page);
    },
  },
  {
    name: "get_ghost_details",
    description:
      "Get ghost review items (items that haunt your review queue after being burned).",
    inputSchema: z.object({
      reviewable_type: z
        .enum(["GrammarPoint", "Vocabulary"])
        .describe("Type of reviewable item"),
    }),
    handler: (client, args) => {
      const { reviewable_type } = args as { reviewable_type: string };
      return client.getGhostDetails(reviewable_type);
    },
  },
  {
    name: "get_forecast_daily",
    description: "Get the upcoming daily review forecast (next N days).",
    inputSchema: z.object({}),
    handler: (client) => client.getForecastDaily(),
  },
  {
    name: "get_forecast_hourly",
    description: "Get the upcoming hourly review forecast for today.",
    inputSchema: z.object({}),
    handler: (client) => client.getForecastHourly(),
  },
  {
    name: "get_review_activity",
    description:
      "Get review activity history (used for the activity/streak graph).",
    inputSchema: z.object({}),
    handler: (client) => client.getReviewActivity(),
  },

  // ── Review History ────────────────────────────────────────────────────────
  {
    name: "get_last_session",
    description: "Get statistics from the most recent review session.",
    inputSchema: z.object({}),
    handler: (client) => client.getLastSession(),
  },
  {
    name: "get_last_24_hours",
    description: "Get review history for the last 24 hours.",
    inputSchema: z.object({}),
    handler: (client) => client.getLast24Hours(),
  },

  // ── Content ───────────────────────────────────────────────────────────────
  {
    name: "get_item",
    description:
      "Get full details for a grammar point or vocabulary item by its slug or ID " +
      "(e.g. 'は-wa-topic-marking-particle' or '42'). " +
      "Returns meaning, structure, example sentences, SRS status, and more.",
    inputSchema: z.object({
      slug_or_id: z
        .string()
        .describe("Item slug (e.g. 'は-wa-topic-marking-particle') or numeric ID"),
    }),
    handler: (client, args) => {
      const { slug_or_id } = args as { slug_or_id: string };
      return client.getItem(slug_or_id);
    },
  },
  {
    name: "get_item_notes",
    description: "Get your personal study notes for a grammar point or vocab item.",
    inputSchema: z.object({
      slug_or_id: z.string().describe("Item slug or numeric ID"),
    }),
    handler: (client, args) => {
      const { slug_or_id } = args as { slug_or_id: string };
      return client.getItemNotes(slug_or_id);
    },
  },
  {
    name: "search",
    description:
      "Search Bunpro grammar points and vocabulary. Returns compact matches " +
      "(id, title, kana, level, meaning) plus a `truncated` field when results were capped. " +
      "Use the grammar/vocab flags to narrow the search and `limit` to cap each section " +
      "(raw payloads can exceed 240 KB). Get full per-item detail via get_item.",
    inputSchema: z.object({
      query: z.string().describe("Search query (e.g. 'は', 'て-form', 'must')"),
      grammar: z
        .boolean()
        .default(true)
        .describe("Include grammar points in results"),
      vocab: z.boolean().default(true).describe("Include vocabulary in results"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe("Max results returned per type (grammar / vocab)"),
    }),
    handler: (client, args) => {
      const { query, grammar, vocab, limit } = args as {
        query: string;
        grammar: boolean;
        vocab: boolean;
        limit: number;
      };
      return client.search(query, { grammar, vocab, limit });
    },
  },

  // ── Review management ────────────────────────────────────────────────────
  {
    name: "add_to_reviews",
    description:
      "Add one or more items to your Bunpro SRS reviews. " +
      "Items start at SRS level 0 and become reviewable immediately. " +
      "Note: reviewable_type for this endpoint is 'Vocab' or 'GrammarPoint' (not 'Vocabulary').",
    inputSchema: z.object({
      reviewables: z
        .array(
          z.object({
            reviewable_id: z.number().int(),
            reviewable_type: z.enum(["Vocab", "GrammarPoint"]),
          })
        )
        .min(1)
        .describe("Items to add to reviews"),
      deck_id: z
        .number()
        .int()
        .nullable()
        .optional()
        .describe("Optional deck ID; null/omitted = default"),
    }),
    handler: (client, args) => {
      const { reviewables, deck_id } = args as {
        reviewables: Array<{ reviewable_id: number; reviewable_type: string }>;
        deck_id?: number | null;
      };
      return client.updateReviewsViaActionType({
        action_type: "add",
        deck_id: deck_id ?? null,
        reviewables: reviewables.map(
          (r) => [r.reviewable_type, r.reviewable_id] as [string, number]
        ),
      });
    },
  },
  {
    name: "remove_from_reviews",
    description: "Remove one or more items from your Bunpro SRS reviews.",
    inputSchema: z.object({
      reviewables: z
        .array(
          z.object({
            reviewable_id: z.number().int(),
            reviewable_type: z.enum(["Vocab", "GrammarPoint"]),
          })
        )
        .min(1),
      deck_id: z.number().int().nullable().optional(),
    }),
    handler: (client, args) => {
      const { reviewables, deck_id } = args as {
        reviewables: Array<{ reviewable_id: number; reviewable_type: string }>;
        deck_id?: number | null;
      };
      return client.updateReviewsViaActionType({
        action_type: "remove",
        deck_id: deck_id ?? null,
        reviewables: reviewables.map(
          (r) => [r.reviewable_type, r.reviewable_id] as [string, number]
        ),
      });
    },
  },

  // ── Bookmarks ─────────────────────────────────────────────────────────────
  {
    name: "add_bookmark",
    description: "Bookmark a Bunpro item for later review.",
    inputSchema: z.object({
      reviewable_id: z.number().int().describe("ID of the item to bookmark"),
      reviewable_type: z
        .enum(["GrammarPoint", "Vocabulary"])
        .describe("Type of item"),
    }),
    handler: (client, args) => {
      return client.addBookmark(args as Record<string, unknown>);
    },
  },
  {
    name: "remove_bookmark",
    description: "Remove a Bunpro bookmark by its bookmark ID.",
    inputSchema: z.object({
      bookmark_id: z.number().int().describe("Bookmark ID to remove"),
    }),
    handler: (client, args) => {
      const { bookmark_id } = args as { bookmark_id: number };
      return client.removeBookmark(bookmark_id);
    },
  },

  // ── Legacy (fallback) ─────────────────────────────────────────────────────
  {
    name: "get_study_queue_legacy",
    description:
      "Get review queue counts using the legacy Bunpro API key (requires BUNPRO_API_KEY). " +
      "Returns reviews available now, next hour, and next day.",
    inputSchema: z.object({}),
    handler: (client) => client.getLegacyStudyQueue(),
  },
  {
    name: "get_recent_items_legacy",
    description:
      "Get recently added grammar points using the legacy Bunpro API key (requires BUNPRO_API_KEY).",
    inputSchema: z.object({
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe("Number of recent items to return (1–50)"),
    }),
    handler: (client, args) => {
      const { limit } = args as { limit: number };
      return client.getLegacyRecentItems(limit);
    },
  },
];
