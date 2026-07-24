/**
 * EMN Recordsサーバー専用のguild commandを登録する。
 *
 * 実行: npx tsx scripts/register-discord-commands.ts
 * 必要な環境変数: DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID
 *
 * globalコマンドとしては登録しない。/emn-adminはdefault_member_permissions=0
 * でDiscord側の見た目を制限するが、これは補助であり、受付APIが毎回
 * operator roleを再確認する。
 */

const SUBCOMMAND = 1;
const STRING = 3;
const USER = 6;

const commands = [
  {
    name: "emn-profile",
    description: "自分の公開プロフィールを確認・更新する",
    // guild内のみ。DMでは使わせない。
    contexts: [0],
    options: [
      {
        type: SUBCOMMAND,
        name: "edit",
        description: "公開プロフィールの更新を開始する",
      },
      {
        type: SUBCOMMAND,
        name: "view",
        description: "現在の登録内容をephemeralで確認する",
      },
      {
        type: SUBCOMMAND,
        name: "lock",
        description: "自分のレコードの一時ロックを申請する",
        options: [
          {
            type: STRING,
            name: "reason",
            description: "ロック理由(任意)",
            required: false,
            max_length: 200,
          },
        ],
      },
    ],
  },
  {
    name: "emn-admin",
    description: "運営者専用のプロフィール管理",
    contexts: [0],
    // 既定では誰にも表示しない。運営者ロールへはサーバー設定で許可する。
    default_member_permissions: "0",
    options: [
      {
        type: SUBCOMMAND,
        name: "representative-set",
        description: "Discordユーザーとmusicianレコードを代表者として紐づける",
        options: [
          {
            type: USER,
            name: "user",
            description: "代表者にするユーザー",
            required: true,
          },
          {
            type: STRING,
            name: "musician",
            description: "対象musicianのslugまたはID",
            required: true,
            max_length: 100,
          },
        ],
      },
      {
        type: SUBCOMMAND,
        name: "profile-lock",
        description: "対象レコードをロックする",
        options: [
          {
            type: STRING,
            name: "musician",
            description: "対象musicianのslugまたはID",
            required: true,
            max_length: 100,
          },
          {
            type: STRING,
            name: "reason",
            description: "ロック理由(任意)",
            required: false,
            max_length: 200,
          },
        ],
      },
      {
        type: SUBCOMMAND,
        name: "profile-unlock",
        description: "対象レコードのロックを解除する",
        options: [
          {
            type: STRING,
            name: "musician",
            description: "対象musicianのslugまたはID",
            required: true,
            max_length: 100,
          },
        ],
      },
      {
        type: SUBCOMMAND,
        name: "profile-hide",
        description: "対象レコードを非公開化する",
        options: [
          {
            type: STRING,
            name: "musician",
            description: "対象musicianのslugまたはID",
            required: true,
            max_length: 100,
          },
        ],
      },
      {
        type: SUBCOMMAND,
        name: "profile-show",
        description: "対象レコードを公開状態へ戻す",
        options: [
          {
            type: STRING,
            name: "musician",
            description: "対象musicianのslugまたはID",
            required: true,
            max_length: 100,
          },
        ],
      },
      {
        type: SUBCOMMAND,
        name: "profile-restore",
        description: "監査ログの過去状態へ復旧する(新しい変更として記録)",
        options: [
          {
            type: STRING,
            name: "musician",
            description: "対象musicianのslugまたはID",
            required: true,
            max_length: 100,
          },
          {
            type: STRING,
            name: "audit_log",
            description: "監査ログID(/emn-admin audit-list で確認)",
            required: true,
            max_length: 36,
          },
          {
            type: STRING,
            name: "state",
            description: "before=その変更の直前 / after=その変更の直後(既定)",
            required: false,
            choices: [
              { name: "after", value: "after" },
              { name: "before", value: "before" },
            ],
          },
        ],
      },
      {
        type: SUBCOMMAND,
        name: "audit-list",
        description: "対象レコードの直近の監査ログIDを確認する",
        options: [
          {
            type: STRING,
            name: "musician",
            description: "対象musicianのslugまたはID",
            required: true,
            max_length: 100,
          },
        ],
      },
    ],
  },
];

async function main() {
  const applicationId = process.env.DISCORD_APPLICATION_ID?.trim();
  const botToken = process.env.DISCORD_BOT_TOKEN?.trim();
  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  if (!applicationId || !botToken || !guildId) {
    console.error(
      "DISCORD_APPLICATION_ID / DISCORD_BOT_TOKEN / DISCORD_GUILD_ID を設定してください。",
    );
    process.exit(1);
  }

  const response = await fetch(
    `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${botToken}`,
      },
      body: JSON.stringify(commands),
    },
  );

  if (!response.ok) {
    // token等の秘密情報は出力しない。
    console.error(`登録に失敗しました: HTTP ${response.status}`);
    const body = (await response.json().catch(() => null)) as unknown;
    if (body) console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }

  const registered = (await response.json()) as Array<{ name: string }>;
  console.log(
    `guild commandを登録しました: ${registered.map((c) => c.name).join(", ")}`,
  );
}

main().catch((error) => {
  console.error("登録処理でエラーが発生しました。", error);
  process.exit(1);
});
