/**
 * Unit tests for cursor-based pagination encode/decode logic.
 *
 * Acceptance criteria (#960):
 * 1. Round-trip encode → decode returns original values exactly.
 * 2. Tampered / malformed cursor is rejected with a CursorError (not
 *    undefined query behaviour).
 * 3. First-page and last-page boundary behaviour.
 * 4. Empty result set returns correctly-shaped pageInfo with both flags false.
 *
 * No network calls are made; all data is in-process.
 */

import { describe, it, expect } from "vitest";
import {
  encodeCursor,
  decodeCursor,
  buildPage,
  CursorError,
  type CursorPayload,
} from "./cursor-pagination";

// ---------------------------------------------------------------------------
// Test-local secret so tests never depend on the env var.
// ---------------------------------------------------------------------------
const SECRET = "test-secret-do-not-use-in-production";

// ---------------------------------------------------------------------------
// 1. Round-trip: encode then decode returns the original values
// ---------------------------------------------------------------------------

describe("round-trip encode/decode", () => {
  it("returns the original sortKey and id after encode → decode", () => {
    const input = { sortKey: "2024-01-15T12:00:00.000Z", id: "campaign_abc123" };
    const cursor = encodeCursor(input, SECRET);
    const decoded = decodeCursor(cursor, SECRET);

    expect(decoded.sortKey).toBe(input.sortKey);
    expect(decoded.id).toBe(input.id);
  });

  it("round-trips a numeric sort key (stored as a string)", () => {
    const input = { sortKey: "9999999999", id: "campaign_num" };
    const cursor = encodeCursor(input, SECRET);
    const decoded = decodeCursor(cursor, SECRET);

    expect(decoded.sortKey).toBe("9999999999");
    expect(decoded.id).toBe("campaign_num");
  });

  it("round-trips unicode characters in sortKey and id", () => {
    const input = { sortKey: "créer-campagne-😀", id: "id-тест-42" };
    const cursor = encodeCursor(input, SECRET);
    const decoded = decodeCursor(cursor, SECRET);

    expect(decoded.sortKey).toBe(input.sortKey);
    expect(decoded.id).toBe(input.id);
  });

  it("round-trips an empty sortKey", () => {
    const input = { sortKey: "", id: "some-id" };
    const cursor = encodeCursor(input, SECRET);
    const decoded = decodeCursor(cursor, SECRET);

    expect(decoded.sortKey).toBe("");
    expect(decoded.id).toBe("some-id");
  });

  it("includes the version field in the decoded payload", () => {
    const cursor = encodeCursor({ sortKey: "sk", id: "id" }, SECRET);
    const decoded = decodeCursor(cursor, SECRET);
    expect(decoded.v).toBe(1);
  });

  it("two different inputs produce different cursors", () => {
    const c1 = encodeCursor({ sortKey: "a", id: "1" }, SECRET);
    const c2 = encodeCursor({ sortKey: "b", id: "2" }, SECRET);
    expect(c1).not.toBe(c2);
  });

  it("same input always produces the same cursor (deterministic)", () => {
    const input = { sortKey: "2024-06-01", id: "stable-id" };
    expect(encodeCursor(input, SECRET)).toBe(encodeCursor(input, SECRET));
  });
});

// ---------------------------------------------------------------------------
// 2. Tampered / malformed cursor rejection
// ---------------------------------------------------------------------------

describe("tampered and malformed cursor rejection", () => {
  it("rejects a cursor with a flipped bit in the payload", () => {
    const cursor = encodeCursor({ sortKey: "sk", id: "id" }, SECRET);
    // Flip one character in the encoded payload (before the '.' separator).
    const dotIdx = cursor.lastIndexOf(".");
    const encoded = cursor.slice(0, dotIdx);
    const sig = cursor.slice(dotIdx);
    const tampered = encoded.slice(0, -1) + (encoded.endsWith("A") ? "B" : "A") + sig;

    expect(() => decodeCursor(tampered, SECRET)).toThrow(CursorError);
  });

  it("rejects a cursor with a replaced signature", () => {
    const cursor = encodeCursor({ sortKey: "sk", id: "id" }, SECRET);
    const dotIdx = cursor.lastIndexOf(".");
    const tampered = cursor.slice(0, dotIdx + 1) + "invalidsignatureXXX";

    expect(() => decodeCursor(tampered, SECRET)).toThrow(CursorError);
  });

  it("rejects a completely arbitrary string", () => {
    expect(() => decodeCursor("this-is-not-a-cursor", SECRET)).toThrow(CursorError);
  });

  it("rejects an empty string", () => {
    expect(() => decodeCursor("", SECRET)).toThrow(CursorError);
  });

  it("rejects a valid-looking base64 string that is not a cursor", () => {
    const fake = Buffer.from('{"sortKey":"x","id":"y"}').toString("base64url") + ".fakesig";
    expect(() => decodeCursor(fake, SECRET)).toThrow(CursorError);
  });

  it("rejects a cursor produced with a different secret", () => {
    const cursor = encodeCursor({ sortKey: "sk", id: "id" }, "secret-A");
    expect(() => decodeCursor(cursor, "secret-B")).toThrow(CursorError);
  });

  it("rejects a cursor missing the signature separator '.'", () => {
    // Raw base64url-encoded JSON without a signature section.
    const raw = Buffer.from(JSON.stringify({ sortKey: "s", id: "i", v: 1 })).toString("base64url");
    expect(() => decodeCursor(raw, SECRET)).toThrow(CursorError);
  });

  it("rejects a cursor with a wrong version number", () => {
    // Manually craft a version-2 payload with the correct HMAC so only the
    // version check can reject it.  We re-use the same signing logic.
    import("node:crypto").then(({ createHmac }) => {
      const payload = JSON.stringify({ sortKey: "s", id: "i", v: 2 });
      const encoded = Buffer.from(payload).toString("base64url");
      const mac = createHmac("sha256", SECRET).update(encoded).digest("base64url");
      const cursor = `${encoded}.${mac}`;
      expect(() => decodeCursor(cursor, SECRET)).toThrow(CursorError);
    });
  });

  it("rejects a cursor with a missing 'id' field", () => {
    import("node:crypto").then(({ createHmac }) => {
      const payload = JSON.stringify({ sortKey: "s", v: 1 }); // no id
      const encoded = Buffer.from(payload).toString("base64url");
      const mac = createHmac("sha256", SECRET).update(encoded).digest("base64url");
      const cursor = `${encoded}.${mac}`;
      expect(() => decodeCursor(cursor, SECRET)).toThrow(CursorError);
    });
  });

  it("throws CursorError (not a generic Error subclass) for all invalid inputs", () => {
    const inputs = ["", "random", "a.b.c", "====="];
    for (const bad of inputs) {
      try {
        decodeCursor(bad, SECRET);
        // If we get here without throwing, force a failure.
        expect.fail(`Expected CursorError for input: "${bad}"`);
      } catch (err) {
        expect(err).toBeInstanceOf(CursorError);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. First-page and last-page boundary behaviour
// ---------------------------------------------------------------------------

interface Item {
  id: string;
  createdAt: string;
  title: string;
}

const makeItems = (count: number): Item[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `campaign_${i + 1}`,
    createdAt: `2024-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
    title: `Campaign ${i + 1}`,
  }));

describe("first-page boundary behaviour", () => {
  it("hasPreviousPage is false on the first page", () => {
    const items = makeItems(3);
    const page = buildPage(
      items,
      (it) => it.id,
      (it) => it.createdAt,
      /* hasNextPage */ true,
      /* hasPreviousPage */ false,
      SECRET,
    );
    expect(page.pageInfo.hasPreviousPage).toBe(false);
  });

  it("startCursor points at the first item", () => {
    const items = makeItems(3);
    const page = buildPage(items, (it) => it.id, (it) => it.createdAt, true, false, SECRET);

    const decoded = decodeCursor(page.pageInfo.startCursor!, SECRET);
    expect(decoded.id).toBe("campaign_1");
  });

  it("endCursor points at the last item of the page", () => {
    const items = makeItems(3);
    const page = buildPage(items, (it) => it.id, (it) => it.createdAt, true, false, SECRET);

    const decoded = decodeCursor(page.pageInfo.endCursor!, SECRET);
    expect(decoded.id).toBe("campaign_3");
  });

  it("edges length equals the number of items", () => {
    const items = makeItems(5);
    const page = buildPage(items, (it) => it.id, (it) => it.createdAt, false, false, SECRET);
    expect(page.edges).toHaveLength(5);
  });

  it("each edge carries the correct node and a valid cursor", () => {
    const items = makeItems(2);
    const page = buildPage(items, (it) => it.id, (it) => it.createdAt, false, false, SECRET);

    for (let i = 0; i < items.length; i++) {
      expect(page.edges[i]!.node).toEqual(items[i]);
      const decoded = decodeCursor(page.edges[i]!.cursor, SECRET);
      expect(decoded.id).toBe(items[i]!.id);
    }
  });
});

describe("last-page boundary behaviour", () => {
  it("hasNextPage is false on the last page", () => {
    const items = makeItems(2);
    const page = buildPage(items, (it) => it.id, (it) => it.createdAt, false, true, SECRET);
    expect(page.pageInfo.hasNextPage).toBe(false);
  });

  it("hasPreviousPage is true on an inner / last page", () => {
    const items = makeItems(2);
    const page = buildPage(items, (it) => it.id, (it) => it.createdAt, false, true, SECRET);
    expect(page.pageInfo.hasPreviousPage).toBe(true);
  });

  it("endCursor round-trips correctly on the last page", () => {
    const items = makeItems(2);
    const page = buildPage(items, (it) => it.id, (it) => it.createdAt, false, true, SECRET);

    const decoded = decodeCursor(page.pageInfo.endCursor!, SECRET);
    expect(decoded.id).toBe("campaign_2");
    expect(decoded.sortKey).toBe(items[1]!.createdAt);
  });
});

// ---------------------------------------------------------------------------
// 4. Empty result set
// ---------------------------------------------------------------------------

describe("empty result set", () => {
  it("returns an empty edges array", () => {
    const page = buildPage<Item>([], (it) => it.id, (it) => it.createdAt, false, false, SECRET);
    expect(page.edges).toHaveLength(0);
  });

  it("hasNextPage is false for an empty result set", () => {
    const page = buildPage<Item>([], (it) => it.id, (it) => it.createdAt, false, false, SECRET);
    expect(page.pageInfo.hasNextPage).toBe(false);
  });

  it("hasPreviousPage is false for an empty result set", () => {
    const page = buildPage<Item>([], (it) => it.id, (it) => it.createdAt, false, false, SECRET);
    expect(page.pageInfo.hasPreviousPage).toBe(false);
  });

  it("startCursor is null for an empty result set", () => {
    const page = buildPage<Item>([], (it) => it.id, (it) => it.createdAt, false, false, SECRET);
    expect(page.pageInfo.startCursor).toBeNull();
  });

  it("endCursor is null for an empty result set", () => {
    const page = buildPage<Item>([], (it) => it.id, (it) => it.createdAt, false, false, SECRET);
    expect(page.pageInfo.endCursor).toBeNull();
  });

  it("pageInfo shape is complete (no missing keys)", () => {
    const page = buildPage<Item>([], (it) => it.id, (it) => it.createdAt, false, false, SECRET);
    expect(page.pageInfo).toEqual({
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: null,
      endCursor: null,
    });
  });
});
