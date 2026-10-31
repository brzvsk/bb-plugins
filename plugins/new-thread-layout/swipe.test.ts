// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { attachSwipeBack } from "./swipe";

function wheel(target: Element, deltaX: number, cancelable: boolean, deltaY = 0) {
  target.dispatchEvent(new WheelEvent("wheel", { deltaX, deltaY, cancelable, bubbles: true }));
}

describe("attachSwipeBack", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  function setup() {
    const area = document.createElement("div");
    const outside = document.createElement("div");
    document.body.append(area, outside);
    const onBack = vi.fn();
    const dispose = attachSwipeBack(document, { area: () => area, onBack });
    return { area, outside, onBack, dispose };
  }

  it("goes back when a swipe right runs past the threshold into momentum", () => {
    vi.useFakeTimers();
    const { area, onBack, dispose } = setup();
    vi.advanceTimersByTime(500);
    wheel(area, -12, true);
    for (let i = 0; i < 25; i++) {
      vi.advanceTimersByTime(8);
      wheel(area, -10, false);
    }
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-ph-swipe-indicator]")).not.toBeNull();
    dispose();
    expect(document.querySelector("[data-ph-swipe-indicator]")).toBeNull();
  });

  it("goes back after the fingers rest with the arrow fully out", () => {
    vi.useFakeTimers();
    const { area, onBack } = setup();
    vi.advanceTimersByTime(500);
    wheel(area, -40, true);
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(8);
      wheel(area, -40, false, 1);
    }
    expect(onBack).not.toHaveBeenCalled();
    vi.advanceTimersByTime(700);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("keeps one swipe when every streamed event is marked cancelable", () => {
    vi.useFakeTimers();
    const { area, onBack } = setup();
    vi.advanceTimersByTime(500);
    for (let i = 0; i < 26; i++) {
      wheel(area, -10, true);
      vi.advanceTimersByTime(10);
    }
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("starts a swipe after a pause even when no wheel event is cancelable", () => {
    vi.useFakeTimers();
    const { area, onBack } = setup();
    for (let i = 0; i < 25; i++) {
      wheel(area, -10, false);
      vi.advanceTimersByTime(8);
    }
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("cancels a short swipe and ignores vertical scrolls, swipes left and swipes outside the area", () => {
    vi.useFakeTimers();
    const { area, outside, onBack } = setup();
    wheel(area, -20, true);
    wheel(area, -20, false, 1);
    vi.advanceTimersByTime(400);
    wheel(area, -2, true, 30);
    for (let i = 0; i < 25; i++) wheel(area, -10, false, 20);
    wheel(area, 12, true);
    for (let i = 0; i < 25; i++) wheel(area, 10, false);
    wheel(outside, -12, true);
    for (let i = 0; i < 25; i++) wheel(outside, -10, false);
    vi.advanceTimersByTime(1000);
    expect(onBack).not.toHaveBeenCalled();
  });
});
