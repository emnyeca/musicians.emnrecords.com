import { ephemeralMessage } from "../components";
import {
  InteractionResponseType,
  InteractionType,
  type Interaction,
} from "../types";
import { handleAdminCommand } from "./admin";
import {
  handlePreviewButton,
  handleProfileCommand,
  handleProfileModalSubmit,
} from "./profile";
import type { HandlerDeps, HandlerResult } from "./shared";

export type { HandlerDeps, HandlerResult } from "./shared";

/**
 * 署名検証済みinteractionのdispatcher。
 * すべてのhandlerがAPI側でguild、role、代表者、lockを再認可する。
 */
export async function handleInteraction(
  interaction: Interaction,
  deps: HandlerDeps,
): Promise<HandlerResult> {
  switch (interaction.type) {
    case InteractionType.Ping:
      return { response: { type: InteractionResponseType.Pong } };
    case InteractionType.ApplicationCommand: {
      const name = interaction.data?.name;
      if (name === "emn-profile") return handleProfileCommand(interaction, deps);
      if (name === "emn-admin") return handleAdminCommand(interaction, deps);
      return { response: ephemeralMessage("不明なコマンドです。") };
    }
    case InteractionType.ModalSubmit:
      return handleProfileModalSubmit(interaction, deps);
    case InteractionType.MessageComponent:
      return handlePreviewButton(interaction, deps);
    default:
      return { response: ephemeralMessage("未対応のinteractionです。") };
  }
}
