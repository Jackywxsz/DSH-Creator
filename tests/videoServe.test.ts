import { describe, expect, it } from "vitest";

import { parseByteRange, playbackOf } from "../src/videoServe.ts";

describe("playbackOf", () => {
  it("prefers the subtitled file", () => {
    expect(playbackOf({
      videoRaw: "/a.mp4",
      videoSubtitled: "/a_subtitled.mp4",
    })).toEqual({ path: "/a_subtitled.mp4", kind: "subtitled" });
  });

  it("falls back to the raw file", () => {
    expect(playbackOf({ videoRaw: "/a.mp4" })).toEqual({ path: "/a.mp4", kind: "raw" });
  });

  it("is empty without a video", () => {
    expect(playbackOf({})).toBeUndefined();
  });
});

describe("parseByteRange", () => {
  it("reads a closed range", () => {
    expect(parseByteRange("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
  });

  it("reads an open end", () => {
    expect(parseByteRange("bytes=100-", 1000)).toEqual({ start: 100, end: 999 });
  });

  it("reads a suffix", () => {
    expect(parseByteRange("bytes=-50", 1000)).toEqual({ start: 950, end: 999 });
  });

  it("rejects a start past the file", () => {
    expect(parseByteRange("bytes=1000-", 1000)).toBeUndefined();
  });
});
