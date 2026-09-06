/**
 * Bot integration catalog — pure data, safe to import from client components.
 * The runtime (verification, parsing, replies) lives in bots.server.ts.
 */
export type BotPlatform = "slack" | "telegram" | "discord";
export const BOT_PLATFORMS: BotPlatform[] = ["slack", "telegram", "discord"];

export type BotField = {
	key: "bot_token" | "signing_secret" | "app_id";
	label: string;
	placeholder?: string;
	optional?: boolean;
};

export type BotMeta = {
	id: BotPlatform;
	name: string;
	blurb: string;
	consoleUrl: string;
	fields: BotField[];
	steps: string[];
	invite?: (appId: string) => string | null;
};

export const BOT_META: Record<BotPlatform, BotMeta> = {
	discord: {
		id: "discord",
		name: "Discord",
		blurb: "Invite the bot to a server; members run /ask and drop PDFs on it.",
		consoleUrl: "https://discord.com/developers/applications",
		fields: [
			{ key: "app_id", label: "Application ID" },
			{ key: "signing_secret", label: "Public key" },
			{ key: "bot_token", label: "Bot token", placeholder: "MTA…" },
		],
		steps: [
			"Create an application in the Discord Developer Portal.",
			"Copy the Application ID and Public Key here, add a bot and copy its token.",
			"Save — the Interactions Endpoint URL and an invite link appear below.",
			"Paste the endpoint URL into the app settings, then open the invite link to add the bot to your server.",
		],
		invite: (appId) =>
			appId
				? `https://discord.com/oauth2/authorize?client_id=${appId}&scope=applications.commands%20bot&permissions=2048`
				: null,
	},
	slack: {
		id: "slack",
		name: "Slack",
		blurb: "Mention the app or DM it; it answers in-thread and reads shared PDFs.",
		consoleUrl: "https://api.slack.com/apps",
		fields: [
			{ key: "bot_token", label: "Bot User OAuth Token", placeholder: "xoxb-…" },
			{ key: "signing_secret", label: "Signing Secret" },
			{ key: "app_id", label: "App ID", optional: true },
		],
		steps: [
			"Create a Slack app and add the app_mentions:read, im:history, files:read and chat:write scopes.",
			"Install it to your workspace; copy the Bot User OAuth Token and Signing Secret here.",
			"Save, then paste the Request URL below into Event Subscriptions and re-install.",
		],
		invite: (appId) => (appId ? `https://app.slack.com/app-settings/-/${appId}/install-on-team` : null),
	},
	telegram: {
		id: "telegram",
		name: "Telegram",
		blurb: "Every message and PDF a user sends the bot is answered by the assistant.",
		consoleUrl: "https://t.me/BotFather",
		fields: [{ key: "bot_token", label: "Bot token (from @BotFather)", placeholder: "123456:ABC-…" }],
		steps: [
			"Create a bot with @BotFather and copy its token here.",
			"Save — Gray Office registers the webhook automatically.",
			"Message your bot; disconnecting removes the webhook.",
		],
		invite: () => null,
	},
};

export function botWebhookUrl(appUrl: string | undefined, platform: BotPlatform, orgId: string): string {
	return `${(appUrl ?? "").replace(/\/$/, "")}/api/bots/${platform}/${orgId}`;
}
