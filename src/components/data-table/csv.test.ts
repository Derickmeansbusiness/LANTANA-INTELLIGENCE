import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(toCsv(["a", "b"], [["x,y", 'say "hi"'], ["line\nbreak", null]])).toBe('﻿a,b\r\n"x,y","say ""hi"""\r\n"line\nbreak",');
  });
  it("neutralises formula injection but keeps negative numbers", () => {
    expect(toCsv(["v"], [["=HYPERLINK(1)"], ["-12.5"], ["@cmd"]])).toBe("﻿v\r\n'=HYPERLINK(1)\r\n-12.5\r\n'@cmd");
  });
});
