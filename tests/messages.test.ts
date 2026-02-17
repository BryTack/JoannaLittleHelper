import { buildGreeting } from "../src/domain/messages";

describe("buildGreeting", () => {
  it("returns a greeting", () => {
    expect(buildGreeting()).toBe("Joanna's Little Helper is ready!");
  });
});
