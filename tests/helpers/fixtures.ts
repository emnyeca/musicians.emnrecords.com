import type { DiscordConfig } from "@/lib/discord/config";
import type { HandlerDeps } from "@/lib/discord/handlers";
import type { Interaction, SubmittedComponent } from "@/lib/discord/types";
import { FakeIntakeStore } from "./fake-store";

export const TEST_CONFIG: DiscordConfig = {
  applicationId: "app-id",
  publicKey: "a".repeat(64),
  guildId: "guild-1",
  memberRoleId: "role-member",
  operatorRoleId: "role-operator",
  botToken: null,
  auditChannelId: null,
};

export type CapturedDeps = HandlerDeps & {
  store: FakeIntakeStore;
  notifications: string[];
  edits: Array<{ token: string; body: Record<string, unknown> }>;
  revalidated: string[];
};

export function makeDeps(
  overrides: Partial<Pick<CapturedDeps, "notify" | "now">> = {},
): CapturedDeps {
  const store = new FakeIntakeStore();
  const notifications: string[] = [];
  const edits: Array<{ token: string; body: Record<string, unknown> }> = [];
  const revalidated: string[] = [];
  return {
    store,
    config: TEST_CONFIG,
    notifications,
    edits,
    revalidated,
    notify:
      overrides.notify ??
      (async (content) => {
        notifications.push(content);
        return true;
      }),
    editOriginal: async (token, body) => {
      edits.push({ token, body });
      return true;
    },
    revalidate: (slug) => {
      revalidated.push(slug);
    },
    now: overrides.now ?? (() => new Date()),
  };
}

let interactionCounter = 0;

function baseInteraction(input: {
  type: number;
  userId?: string;
  roles?: string[];
  guildId?: string | null;
  data?: Interaction["data"];
}): Interaction {
  interactionCounter += 1;
  return {
    id: `interaction-${interactionCounter}`,
    application_id: TEST_CONFIG.applicationId,
    type: input.type,
    token: `token-${interactionCounter}`,
    ...(input.guildId === null ? {} : { guild_id: input.guildId ?? TEST_CONFIG.guildId }),
    member:
      input.guildId === null
        ? undefined
        : {
            user: { id: input.userId ?? "user-1", username: "tester" },
            roles: input.roles ?? [TEST_CONFIG.memberRoleId],
          },
    data: input.data,
  };
}

export function commandInteraction(input: {
  command: "emn-profile" | "emn-admin";
  subcommand: string;
  options?: Record<string, string>;
  userId?: string;
  roles?: string[];
  guildId?: string | null;
  resolved?: unknown;
}): Interaction {
  return baseInteraction({
    type: 2,
    userId: input.userId,
    roles: input.roles,
    guildId: input.guildId,
    data: {
      name: input.command,
      options: [
        {
          name: input.subcommand,
          type: 1,
          options: Object.entries(input.options ?? {}).map(([name, value]) => ({
            name,
            type: 3,
            value,
          })),
        },
      ],
      resolved: input.resolved,
    },
  });
}

/** Label component内へText Inputを置いた、現行仕様のModal submit payload。 */
export function modalSubmitInteraction(input: {
  customId: string;
  values: Record<string, string>;
  userId?: string;
  roles?: string[];
  guildId?: string | null;
}): Interaction {
  const components: SubmittedComponent[] = Object.entries(input.values).map(
    ([customId, value]) => ({
      type: 18,
      component: { type: 4, custom_id: customId, value },
    }),
  );
  return baseInteraction({
    type: 5,
    userId: input.userId,
    roles: input.roles,
    guildId: input.guildId,
    data: { custom_id: input.customId, components },
  });
}

export function buttonInteraction(input: {
  customId: string;
  userId?: string;
  roles?: string[];
  guildId?: string | null;
}): Interaction {
  return baseInteraction({
    type: 3,
    userId: input.userId,
    roles: input.roles,
    guildId: input.guildId,
    data: { custom_id: input.customId, component_type: 2 },
  });
}

export const VALID_BASIC_INPUTS: Record<string, string> = {
  display_name: "新しい名前",
  name_jp: "新しい名前",
  name_en: "New Name",
  roles: "Vo, Gt",
  primary_sns_url: "https://x.com/example",
};
