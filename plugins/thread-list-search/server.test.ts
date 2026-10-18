import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { describe, expect, it } from "vitest";
import plugin, { THREAD_LIST_PLUGIN_ID } from "./server.js";
import { defaultPreferences } from "./shared/preferences.js";

interface ForwardedCall {
  pluginId: string;
  method: string;
  input: unknown;
}

function setup() {
  const calls: ForwardedCall[] = [];
  const stored = defaultPreferences() as Record<string, unknown>;
  const host = createFakePluginHost({
    pluginId: "thread-list-search",
    sdk: {
      plugins: {
        callRpc: async ({ pluginId, method, input, outputSchema }) => {
          calls.push({ pluginId, method, input });
          const args = input as { key: string; value?: unknown } | null;
          let result: unknown;
          if (method === "listPreferences") {
            result = { preferences: stored };
          } else if (method === "setPreference" && args !== null) {
            stored[args.key] = args.value;
            result = { key: args.key, value: args.value };
          } else if (method === "resetPreference" && args !== null) {
            const value = (defaultPreferences() as Record<string, unknown>)[
              args.key
            ];
            stored[args.key] = value;
            result = { key: args.key, value };
          }
          return outputSchema.parse(result);
        },
      },
    },
  });
  return { ...host, calls };
}

describe("thread-list-search preference proxy", () => {
  it("reads preferences from bb's Thread list plugin", async () => {
    const { bb, harness, calls } = setup();
    await plugin(bb);
    const listed = (await harness.callRpc("listPreferences", null)) as {
      preferences: { threadLifecycles: string[] };
    };
    expect(listed.preferences.threadLifecycles).toEqual(["active"]);
    expect(calls).toEqual([
      { pluginId: THREAD_LIST_PLUGIN_ID, method: "listPreferences", input: null },
    ]);
  });

  it("writes through to bb's Thread list plugin and republishes the change", async () => {
    const { bb, harness, calls } = setup();
    await plugin(bb);
    const written = await harness.callRpc("setPreference", {
      key: "threadLifecycles",
      value: ["active", "archived"],
    });
    expect(written).toEqual({
      key: "threadLifecycles",
      value: ["active", "archived"],
    });
    expect(calls.at(-1)).toEqual({
      pluginId: THREAD_LIST_PLUGIN_ID,
      method: "setPreference",
      input: { key: "threadLifecycles", value: ["active", "archived"] },
    });
    expect(harness.inspection.realtimeSignals).toEqual([
      {
        channel: "preferences",
        payload: { key: "threadLifecycles", value: ["active", "archived"] },
      },
    ]);
  });

  it("rejects unknown preference keys before forwarding", async () => {
    const { bb, harness, calls } = setup();
    await plugin(bb);
    await expect(
      harness.callRpc("setPreference", { key: "nope", value: 1 }),
    ).rejects.toThrow();
    expect(calls).toEqual([]);
  });
});
