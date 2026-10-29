import { describe, expect, it } from "vitest";

import { readBodyLimited } from "./read-body";

function chunked(parts: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part));
      controller.close();
    },
  });
  return new Request("https://x.test/", { method: "POST", body: stream, duplex: "half" } as RequestInit);
}

describe("readBodyLimited", () => {
  it("lê até o limite e para quando passa, mesmo sem Content-Length", async () => {
    expect(await readBodyLimited(chunked(["olá ", "mundo"]), 100)).toBe("olá mundo");
    expect(await readBodyLimited(chunked(["x".repeat(60), "x".repeat(60)]), 100)).toBeNull();
    expect(await readBodyLimited(new Request("https://x.test/", { method: "POST", body: "abc", headers: { "content-length": "999" } }), 10)).toBeNull();
  });
});
