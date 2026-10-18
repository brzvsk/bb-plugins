import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import {
  PREFERENCE_KEYS,
  PREFERENCES_CHANGED_CHANNEL,
  preferenceDefinitions,
  type PreferenceKey,
} from "./shared/preferences.js";

// Layout preferences stay owned by bb's built-in Thread list plugin, so this
// list, bb's list, and `bb thread-list prefs` share one source of truth. This
// server only forwards the frontend's preference RPC to it.
export const THREAD_LIST_PLUGIN_ID = "thread-list";

const preferenceKeySchema = z.enum(
  PREFERENCE_KEYS as [PreferenceKey, ...PreferenceKey[]],
);

const preferenceValuesSchema = z.object(
  Object.fromEntries(
    PREFERENCE_KEYS.map((key) => [key, preferenceDefinitions[key].schema]),
  ) as { [Key in PreferenceKey]: (typeof preferenceDefinitions)[Key]["schema"] },
);

const listPreferencesOutput = z
  .object({ preferences: preferenceValuesSchema })
  .strict();
const preferenceWriteOutput = z
  .object({ key: preferenceKeySchema, value: z.unknown() })
  .strict();

export const threadListRpcContract = defineRpcContract({
  listPreferences: {
    input: z.null(),
    output: listPreferencesOutput,
  },
  setPreference: {
    input: z.object({ key: preferenceKeySchema, value: z.unknown() }).strict(),
    output: preferenceWriteOutput,
  },
  resetPreference: {
    input: z.object({ key: preferenceKeySchema }).strict(),
    output: preferenceWriteOutput,
  },
});

export default async function threadListSearchPlugin(bb: BbPluginApi) {
  async function forwardWrite(
    method: "setPreference" | "resetPreference",
    input: { key: PreferenceKey; value?: unknown },
  ) {
    const result = await bb.sdk.plugins.callRpc({
      pluginId: THREAD_LIST_PLUGIN_ID,
      method,
      input: input as Parameters<typeof bb.sdk.plugins.callRpc>[0]["input"],
      outputSchema: preferenceWriteOutput,
    });
    // bb's list publishes on its own plugin channel; republish so every
    // window running this list picks the change up.
    bb.realtime.publish(PREFERENCES_CHANGED_CHANNEL, result);
    return result;
  }

  bb.rpc.register(threadListRpcContract, {
    async listPreferences() {
      return bb.sdk.plugins.callRpc({
        pluginId: THREAD_LIST_PLUGIN_ID,
        method: "listPreferences",
        input: null,
        outputSchema: listPreferencesOutput,
      });
    },
    async setPreference({ key, value }) {
      return forwardWrite("setPreference", { key, value });
    },
    async resetPreference({ key }) {
      return forwardWrite("resetPreference", { key });
    },
  });
}
