import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { deepFindToken, trimSearch, readTokenFromFile } from "../src/client.ts";

test("deepFindToken finds a nested BUNPRO_API_TOKEN", () => {
  const cfg = {
    mcpServers: { bunpro: { env: { BUNPRO_API_TOKEN: "abc123", OTHER: "x" } } },
  };
  assert.equal(deepFindToken(cfg), "abc123");
});

test("deepFindToken returns undefined when absent or empty", () => {
  assert.equal(deepFindToken({ a: { b: 1 } }), undefined);
  assert.equal(deepFindToken({ env: { BUNPRO_API_TOKEN: "" } }), undefined);
  assert.equal(deepFindToken(null), undefined);
});

test("readTokenFromFile honors BUNPRO_TOKEN_FILE and tolerates a missing file", () => {
  const file = join(tmpdir(), `bunpro-mcp-test-${process.pid}.json`);
  writeFileSync(file, JSON.stringify({ deep: { BUNPRO_API_TOKEN: "tok-from-file" } }));
  const prev = process.env.BUNPRO_TOKEN_FILE;
  try {
    process.env.BUNPRO_TOKEN_FILE = file;
    assert.equal(readTokenFromFile(), "tok-from-file");

    process.env.BUNPRO_TOKEN_FILE = join(tmpdir(), "does-not-exist-xyz.json");
    assert.equal(readTokenFromFile(), undefined); // missing file -> undefined, never throws
  } finally {
    if (prev === undefined) delete process.env.BUNPRO_TOKEN_FILE;
    else process.env.BUNPRO_TOKEN_FILE = prev;
    rmSync(file, { force: true });
  }
});

test("trimSearch projects compact fields and caps each section", () => {
  const raw = {
    grammar_points: {
      data: [
        { attributes: { id: 1, title: "べき", kana: null, slug: "beki", level: "JLPT3", meaning: "should", type_pascal: "GrammarPoint", nuance: "HUGE", coverage_vocab_ids: [1, 2, 3] } },
        { attributes: { id: 2, title: "べきではない", slug: "x", jlpt_level: "JLPT3", meaning: "should not", type_pascal: "GrammarPoint" } },
      ],
    },
    vocabs: {
      data: Array.from({ length: 5 }, (_, i) => ({ attributes: { id: 100 + i, title: `v${i}`, kana: `か${i}`, slug: `v${i}`, jlpt_level: "N5", meaning: "m", type_pascal: "Vocab" } })),
    },
  };

  const out = trimSearch(raw, 3);
  assert.equal(out.grammar_points.length, 2);
  assert.equal(out.vocabs.length, 3); // capped at limit
  assert.equal(out.truncated.grammar, false);
  assert.equal(out.truncated.vocab, "3/5"); // truncation reported, not silent

  // heavy fields are dropped; level falls back from jlpt_level
  const g = out.grammar_points[0] as Record<string, unknown>;
  assert.equal(g.level, "JLPT3");
  assert.equal("nuance" in g, false);
  assert.equal("coverage_vocab_ids" in g, false);
  assert.equal((out.grammar_points[1] as Record<string, unknown>).level, "JLPT3");
});

test("trimSearch handles empty / missing sections", () => {
  const out = trimSearch({}, 20);
  assert.deepEqual(out.grammar_points, []);
  assert.deepEqual(out.vocabs, []);
  assert.equal(out.truncated.grammar, false);
  assert.equal(out.truncated.vocab, false);
});
