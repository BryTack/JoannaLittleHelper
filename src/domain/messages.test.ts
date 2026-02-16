import { buildGreeting } from "./messages";

describe("buildGreeting", () => {
  it("returns a greeting", () => {
    expect(buildGreeting()).toBe("Joanna's Little Helper is ready!");
  });
});
