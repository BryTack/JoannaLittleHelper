import { buildHelloMessage } from "./messages";

describe("buildHelloMessage", () => {
  it("returns a greeting", () => {
    expect(buildHelloMessage()).toBe("Hello World");
  });
});
