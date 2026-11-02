import { sha256 } from "@noble/hashes/sha2.js";
self.onmessage = (e: MessageEvent<ArrayBuffer>) => {
  const digest = Array.from(sha256(new Uint8Array(e.data)), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
  self.postMessage(digest);
};
