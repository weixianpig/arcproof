import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashFile } from "../lib/hash";

describe("browser file hashing", () => {
  it("matches the SHA-256 standard vector for abc", async () => {
    const file = new File(["abc"], "ignored-name.txt");
    assert.equal(await hashFile(file), "0xba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("depends only on bytes, not the filename", async () => {
    const first = new File(["same bytes"], "private-name.pdf");
    const second = new File(["same bytes"], "different-name.docx");
    assert.equal(await hashFile(first), await hashFile(second));
  });

  it("produces a different hash for different bytes", async () => {
    const first = new File(["first"], "fixture.txt");
    const second = new File(["second"], "fixture.txt");
    assert.notEqual(await hashFile(first), await hashFile(second));
  });
});
