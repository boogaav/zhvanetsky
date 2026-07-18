import { describe, expect, it } from "vitest";
import {
  checkDistinctAlternatives,
  checkLineRange,
  checkNoCliches,
  checkNoEmojis,
  checkNoHashtags,
  checkNoHeadings,
  checkNotEmpty,
  checkNotWrappedInQuotes,
  checkPreserved,
  countLines,
} from "@/evals/rubric";

describe("deterministic quality checks", () => {
  it("counts non-empty lines", () => {
    expect(countLines("a\n\nb\nc\n")).toBe(3);
  });

  it("flags empty output", () => {
    expect(checkNotEmpty("   ").ok).toBe(false);
    expect(checkNotEmpty("text").ok).toBe(true);
  });

  it("enforces the line range per length", () => {
    expect(checkLineRange("one line", "one-liner").ok).toBe(true);
    expect(checkLineRange("a\nb", "one-liner").ok).toBe(false);
    expect(checkLineRange("a\nb\nc\nd", "short").ok).toBe(true);
    expect(checkLineRange("a\nb", "short").ok).toBe(false);
    expect(checkLineRange(Array(9).fill("x").join("\n"), "mini-monologue").ok).toBe(true);
  });

  it("catches accidental headings and meta-introductions", () => {
    expect(checkNoHeadings("# Title\ntext").ok).toBe(false);
    expect(checkNoHeadings("Here is your version:\ntext").ok).toBe(false);
    expect(checkNoHeadings("Вот ваш вариант: текст").ok).toBe(false);
    expect(checkNoHeadings("An ordinary line.").ok).toBe(true);
  });

  it("catches emojis and hashtags", () => {
    expect(checkNoEmojis("nice 😀").ok).toBe(false);
    expect(checkNoEmojis("plain text").ok).toBe(true);
    expect(checkNoHashtags("so #blessed").ok).toBe(false);
    expect(checkNoHashtags("issue number 4").ok).toBe(true);
  });

  it("catches banned AI cliches case-insensitively", () => {
    expect(checkNoCliches("Plot Twist: it failed").ok).toBe(false);
    expect(checkNoCliches("At the end of the day, nothing").ok).toBe(false);
    expect(checkNoCliches("A quiet ordinary evening").ok).toBe(true);
  });

  it("catches results wrapped in quotation marks", () => {
    expect(checkNotWrappedInQuotes('"whole thing quoted"').ok).toBe(false);
    expect(checkNotWrappedInQuotes("«всё в кавычках»").ok).toBe(false);
    expect(checkNotWrappedInQuotes('He said "part" only.').ok).toBe(true);
  });

  it("verifies preserved names and numbers", () => {
    expect(checkPreserved("Ivan waited 40 minutes", ["Ivan", "40"]).ok).toBe(true);
    const failed = checkPreserved("someone waited", ["Ivan", "40"]);
    expect(failed.ok).toBe(false);
    expect(failed.detail).toContain("Ivan");
  });

  it("detects duplicate alternatives", () => {
    expect(
      checkDistinctAlternatives("a", [{ text: "b" }, { text: "b" }]).ok
    ).toBe(false);
    expect(
      checkDistinctAlternatives("a", [{ text: "b" }, { text: "c" }]).ok
    ).toBe(true);
  });
});
