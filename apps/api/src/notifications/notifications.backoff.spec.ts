import { backoffDelay } from "./notifications.backoff"

describe("backoffDelay", () => {
  const mid = () => 0.5 // jitter factor 1.0

  it("grows exponentially", () => {
    expect(backoffDelay(1, undefined, mid)).toBe(5_000)
    expect(backoffDelay(2, undefined, mid)).toBe(10_000)
    expect(backoffDelay(3, undefined, mid)).toBe(20_000)
  })

  it("caps at ten minutes", () => {
    expect(backoffDelay(20, undefined, mid)).toBe(600_000)
  })

  it("applies +-20% jitter", () => {
    expect(backoffDelay(1, undefined, () => 0)).toBe(4_000)
    expect(backoffDelay(1, undefined, () => 1)).toBe(6_000)
  })

  it("lets retry_after override the backoff", () => {
    expect(backoffDelay(5, 1_500, mid)).toBe(1_500)
  })
})
