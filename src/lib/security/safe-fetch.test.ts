// @vitest-environment node
import { describe, expect, it } from "vitest";

import { isBlockedAddress } from "./ip";
import { assertPublicUrl, safeFetch, SafeFetchError } from "./safe-fetch";

describe("isBlockedAddress (SSRF)", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.0.10",
    "169.254.169.254", // metadados de nuvem
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "64:ff9b::10.0.0.1",
    "não-é-ip",
  ])("bloqueia %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("libera %s", (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });
});

describe("assertPublicUrl", () => {
  it("aceita https público", () => {
    expect(assertPublicUrl("https://nextjs.org/feed.xml").hostname).toBe("nextjs.org");
  });

  it.each([
    ["file:///etc/passwd", "blocked_url"],
    ["ftp://example.com/x", "blocked_url"],
    ["gopher://example.com", "blocked_url"],
    ["https://user:pass@example.com/", "blocked_url"],
    ["https://example.com:8080/", "blocked_url"],
    ["http://localhost/", "blocked_url"],
    ["http://intranet/", "blocked_url"],
    ["http://metadata.internal/", "blocked_url"],
    ["http://127.0.0.1/", "blocked_address"],
    ["http://169.254.169.254/latest/meta-data", "blocked_address"],
    ["http://[::1]/", "blocked_address"],
    ["http://[::ffff:10.0.0.1]/", "blocked_address"],
    ["não é url", "invalid_url"],
  ])("recusa %s", (url, code) => {
    expect(() => assertPublicUrl(url)).toThrow(expect.objectContaining({ code }));
  });

  it("safeFetch recusa destino interno antes de conectar", async () => {
    await expect(safeFetch("http://127.0.0.1:80/")).rejects.toBeInstanceOf(SafeFetchError);
    await expect(safeFetch("http://127.0.0.1/")).rejects.toMatchObject({ code: "blocked_address" });
  });
});
