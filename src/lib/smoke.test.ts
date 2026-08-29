import { describe, expect, it } from "vitest";
import { greet } from "./smoke";

describe("greet", () => {
  it("名前を受け取って挨拶を返す", () => {
    expect(greet("world")).toBe("hello, world");
  });
});
