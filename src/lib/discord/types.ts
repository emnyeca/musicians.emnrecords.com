/**
 * Discord Interactionsの最小限の型定義。
 * 参照正本: Discord公式 Receiving and Responding / Component Reference。
 */

export const InteractionType = {
  Ping: 1,
  ApplicationCommand: 2,
  MessageComponent: 3,
  ApplicationCommandAutocomplete: 4,
  ModalSubmit: 5,
} as const;

export const InteractionResponseType = {
  Pong: 1,
  ChannelMessageWithSource: 4,
  DeferredChannelMessageWithSource: 5,
  DeferredUpdateMessage: 6,
  UpdateMessage: 7,
  Modal: 9,
} as const;

export const MessageFlags = {
  Ephemeral: 64,
} as const;

export const ComponentType = {
  ActionRow: 1,
  Button: 2,
  StringSelect: 3,
  TextInput: 4,
  Label: 18,
} as const;

export const ButtonStyle = {
  Primary: 1,
  Secondary: 2,
  Success: 3,
  Danger: 4,
} as const;

export const TextInputStyle = {
  Short: 1,
  Paragraph: 2,
} as const;

export type DiscordUser = {
  id: string;
  username?: string;
  global_name?: string | null;
};

export type GuildMember = {
  user?: DiscordUser;
  nick?: string | null;
  roles: string[];
};

export type CommandOption = {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: CommandOption[];
};

/** Modal submitで返ってくるcomponentツリー(Label形式とAction Row形式の両方)。 */
export type SubmittedComponent = {
  type?: number;
  custom_id?: string;
  value?: string;
  component?: SubmittedComponent;
  components?: SubmittedComponent[];
};

export type InteractionData = {
  id?: string;
  name?: string;
  type?: number;
  options?: CommandOption[];
  custom_id?: string;
  component_type?: number;
  components?: SubmittedComponent[];
  resolved?: unknown;
};

export type Interaction = {
  id: string;
  application_id: string;
  type: number;
  token: string;
  guild_id?: string;
  channel_id?: string;
  member?: GuildMember;
  user?: DiscordUser;
  data?: InteractionData;
};

export type InteractionResponse = {
  type: number;
  data?: Record<string, unknown>;
};

/** Modal submitのcomponentツリーからText Input値をcustom_idで平坦化する。 */
export function collectTextInputValues(
  components: SubmittedComponent[] | undefined,
): Record<string, string> {
  const values: Record<string, string> = {};
  const walk = (node: SubmittedComponent | undefined) => {
    if (!node) return;
    if (node.type === ComponentType.TextInput && node.custom_id) {
      values[node.custom_id] = typeof node.value === "string" ? node.value : "";
    }
    if (node.component) walk(node.component);
    if (Array.isArray(node.components)) node.components.forEach(walk);
  };
  (components ?? []).forEach(walk);
  return values;
}

/** subcommand構造から実行対象のsubcommand名とoptionsを取り出す。 */
export function resolveSubcommand(data: InteractionData | undefined): {
  name: string | null;
  options: Record<string, string | number | boolean>;
} {
  const first = data?.options?.[0];
  if (!first || first.type !== 1) return { name: null, options: {} };
  const options: Record<string, string | number | boolean> = {};
  for (const option of first.options ?? []) {
    if (option.value !== undefined) options[option.name] = option.value;
  }
  return { name: first.name, options };
}
