# Build: Discord + Slack + Telegram Agent Integrations

## Objective

Add Discord, Slack, and Telegram integrations to our existing SaaS product.

The product already has an AI agent/backend that can:

- Receive a user message
- Authenticate/authorize the user
- Call internal tools
- Fetch information from our backend/database
- Perform actions through our backend
- Return a text response and optionally structured actions/buttons

The goal is to allow the **same agent** to be used from:

1. Web application
2. Discord
3. Slack
4. Telegram

Do NOT create separate AI/agent logic for each integration.

Instead, build platform adapters that translate platform-specific messages into a common internal AgentRequest and translate AgentResponse back into the platform's format.

---

# 1. Target Architecture

Use this architecture:

```text
                         ┌─────────────────────┐
                         │      Web App        │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │                     │
                         │    Agent Gateway    │
                         │                     │
                         │ Authentication      │
                         │ Authorization       │
                         │ Conversation        │
                         │ Agent execution     │
                         │ Tool execution      │
                         │                     │
                         └──────────┬──────────┘
                                    │
                     ┌──────────────┼──────────────┐
                     │              │              │
                     ▼              ▼              ▼
              Discord Adapter  Slack Adapter  Telegram Adapter
                     │              │              │
                     ▼              ▼              ▼
                  Discord         Slack        Telegram
```

The Agent Gateway must be platform-independent.

The agent should never need to know how Discord, Slack, or Telegram works.

---

# 2. Common Internal Interface

Create a common interface.

Example:

```typescript
type AgentRequest = {
  organizationId: string;
  userId: string;
  conversationId: string;

  source: "web" | "discord" | "slack" | "telegram";

  message: string;

  metadata?: {
    discord?: {
      guildId?: string;
      channelId?: string;
      userId?: string;
    };

    slack?: {
      teamId?: string;
      channelId?: string;
      userId?: string;
    };

    telegram?: {
      chatId?: string;
      userId?: string;
    };
  };
};
```

Agent response:

```typescript
type AgentResponse = {
  text: string;

  actions?: Array<{
    id: string;
    label: string;
    type: "button" | "link";
    url?: string;
  }>;

  attachments?: Array<{
    type: string;
    url: string;
    filename?: string;
  }>;
};
```

Every integration must eventually call:

```typescript
await agentGateway.execute(request);
```

---

# 3. Database Schema

Create a generic integration table.

Example:

```sql
CREATE TABLE integrations (
    id UUID PRIMARY KEY,

    organization_id UUID NOT NULL,

    provider VARCHAR(32) NOT NULL,
    -- discord | slack | telegram

    status VARCHAR(32) NOT NULL DEFAULT 'active',
    -- active | disconnected | revoked

    external_workspace_id VARCHAR(255),
    external_workspace_name VARCHAR(255),

    bot_user_id VARCHAR(255),

    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,

    scopes TEXT,

    metadata JSONB,

    installed_at TIMESTAMP,
    disconnected_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(provider, external_workspace_id)
);
```

Do NOT store plaintext OAuth tokens or bot tokens.

Encrypt secrets at rest.

---

# 4. Identity Mapping

This is critical.

A platform user must map to a user in our application.

Create:

```sql
CREATE TABLE integration_identities (
    id UUID PRIMARY KEY,

    integration_id UUID NOT NULL,

    organization_id UUID NOT NULL,

    user_id UUID,

    provider VARCHAR(32) NOT NULL,

    external_user_id VARCHAR(255) NOT NULL,

    external_username VARCHAR(255),

    metadata JSONB,

    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(provider, external_user_id, organization_id)
);
```

Example:

```text
Discord user:
123456789

maps to:

Our user:
user_abc

inside:

Organization:
org_xyz
```

Never trust an organization ID supplied by a Discord/Slack/Telegram message.

Determine the organization from our stored integration/identity mapping.

---

# 5. Discord Integration

## Authentication

Use a Discord application with:

```text
Client ID
Client Secret
Bot Token
```

The Bot Token must ONLY exist on the backend.

Never expose it to the browser.

Use OAuth2/application installation to allow customers to install the bot into their Discord server.

The install flow should request only the permissions/scopes required by the application.

Example install URL:

```text
https://discord.com/oauth2/authorize
  ?client_id=DISCORD_CLIENT_ID
  &scope=bot%20applications.commands
  &permissions=REQUIRED_PERMISSIONS
```

If an OAuth callback is used, validate the returned state and associate the installation with the currently authenticated organization.

---

## Discord User Flow

Dashboard:

```text
Integrations
    ↓
Discord
    ↓
[Connect Discord]
    ↓
Discord authorization/install
    ↓
Select Discord server
    ↓
Authorize bot
    ↓
Redirect/callback
    ↓
Backend records guild
    ↓
Dashboard shows:

Discord
🟢 Connected

Server:
Acme Community
```

Database:

```text
organization_id = org_123
provider = discord
external_workspace_id = guild_456
external_workspace_name = Acme Community
status = active
```

---

# 6. Discord Message Flow

Support both:

```text
@Agent what is our revenue this month?
```

and preferably:

```text
/agent what is our revenue this month?
```

Flow:

```text
Discord
   ↓
Discord Gateway / Interaction
   ↓
Discord Adapter
   ↓
Find guild_id
   ↓
Find integration
   ↓
Find Discord user mapping
   ↓
Authenticate/authorize
   ↓
AgentRequest
   ↓
Agent Gateway
   ↓
Existing tools/backend
   ↓
AgentResponse
   ↓
Discord Adapter
   ↓
Discord message
```

Example internal request:

```json
{
  "organizationId": "org_123",
  "userId": "user_456",
  "conversationId": "discord:guild_789:channel_123",
  "source": "discord",
  "message": "What is our revenue this month?",
  "metadata": {
    "discord": {
      "guildId": "guild_789",
      "channelId": "channel_123",
      "userId": "discord_user_999"
    }
  }
}
```

---

# 7. Discord Backend-to-Discord Notifications

The backend should also be able to proactively send messages.

Example:

```text
Backend detects:
AWS spending increased by 35%

        ↓

Notification service

        ↓

Discord Adapter

        ↓

Discord API

        ↓

#alerts

⚠️ AWS Spending Alert

Spending increased 35% this week.
```

Create an internal interface:

```typescript
await notificationService.send({
  organizationId,
  provider: "discord",
  channelId,
  message,
});
```

---

# 8. Slack Integration

Slack should use OAuth2.

The user flow:

```text
Dashboard
    ↓
[Connect Slack]
    ↓
Slack OAuth
    ↓
User selects workspace
    ↓
Approve permissions
    ↓
Slack redirects to our callback
    ↓
Backend validates OAuth state
    ↓
Exchange authorization code
    ↓
Store installation
    ↓
Dashboard:

Slack
🟢 Connected

Workspace:
Acme
```

Store:

```text
provider = slack
external_workspace_id = team_id
external_workspace_name = team_name
bot_user_id = bot_user_id
access_token_encrypted = ...
scopes = ...
```

Use Slack Events API or Socket Mode for receiving events.

---

# 9. Slack Message Flow

```text
Slack
   ↓
Events API / Socket Mode
   ↓
Slack Adapter
   ↓
Find team_id
   ↓
Find integration
   ↓
Find Slack user mapping
   ↓
Agent Gateway
   ↓
Existing backend/tools
   ↓
AgentResponse
   ↓
Slack Adapter
   ↓
Slack message
```

Example:

```text
User:

@Agent how much did we spend on AWS?

       ↓

Agent:

AWS spending this month is ₹2.8L,
up 12% from last month.

[View details]
```

---

# 10. Telegram Integration

Telegram is different.

Do NOT treat Telegram like Slack/Discord OAuth.

Telegram uses a bot token.

Create a bot through BotFather and configure:

```text
TELEGRAM_BOT_TOKEN
```

Store the token securely on the backend.

Configure a Telegram webhook:

```text
POST /webhooks/telegram
```

Telegram sends updates to this endpoint.

---

# 11. Telegram Connection Flow

Use a deep-link connection flow.

Example:

```text
Dashboard
    ↓
Telegram
    ↓
[Connect Telegram]
    ↓
Backend generates one-time connection token
    ↓
User clicks:

https://t.me/YourAgentBot?start=CONNECTION_TOKEN
    ↓
Telegram bot receives:

/start CONNECTION_TOKEN
    ↓
Backend validates token
    ↓
Maps:

telegram_user_id
        ↓
our user_id
        ↓
organization_id
    ↓
Dashboard shows:

Telegram
🟢 Connected
```

Never put an actual organization ID or sensitive information directly into the Telegram URL.

Use a short-lived, random, one-time connection token.

Example:

```text
tg_conn_7f83ab91...
```

Store:

```text
connection_token_hash
organization_id
user_id
expires_at
used_at
```

---

# 12. Telegram Message Flow

```text
Telegram
   ↓
Webhook
   ↓
Verify webhook secret
   ↓
Telegram Adapter
   ↓
Find chat_id/user_id
   ↓
Find identity mapping
   ↓
Agent Gateway
   ↓
Existing backend/tools
   ↓
AgentResponse
   ↓
Telegram Bot API
   ↓
User
```

Example:

```text
User:

What invoices are overdue?

       ↓

Agent:

You have 4 overdue invoices:

INV-1023 — ₹45,000
INV-1031 — ₹82,000
INV-1035 — ₹21,500
INV-1040 — ₹63,000

Total overdue: ₹2,11,500
```

---

# 13. Unified Integration API

Create APIs such as:

```http
GET /api/integrations
```

Response:

```json
{
  "discord": {
    "connected": true,
    "name": "Acme Community"
  },
  "slack": {
    "connected": true,
    "name": "Acme Workspace"
  },
  "telegram": {
    "connected": false
  }
}
```

Discord:

```http
GET /api/integrations/discord
POST /api/integrations/discord/connect
DELETE /api/integrations/discord
```

Slack:

```http
GET /api/integrations/slack
POST /api/integrations/slack/connect
GET /api/integrations/slack/callback
DELETE /api/integrations/slack
```

Telegram:

```http
GET /api/integrations/telegram
POST /api/integrations/telegram/connect
DELETE /api/integrations/telegram
```

---

# 14. Webhook Endpoints

Create:

```text
POST /webhooks/discord
POST /webhooks/slack
POST /webhooks/telegram
```

However, use the appropriate platform mechanism rather than assuming every event is delivered through an HTTP webhook.

Discord can use Gateway/Interactions.

Slack can use Events API or Socket Mode.

Telegram uses Bot API webhooks.

Each handler should:

1. Verify authenticity/signature/secret.
2. Parse the event.
3. Ignore unsupported events.
4. Prevent duplicate processing.
5. Resolve organization.
6. Resolve user.
7. Create AgentRequest.
8. Execute the agent.
9. Send response.
10. Record message/event ID for idempotency.

---

# 15. Idempotency

This is mandatory.

Platforms may retry events.

Create:

```sql
CREATE TABLE integration_events (
    id UUID PRIMARY KEY,

    provider VARCHAR(32) NOT NULL,

    external_event_id VARCHAR(255) NOT NULL,

    integration_id UUID,

    processed_at TIMESTAMP,

    status VARCHAR(32),

    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(provider, external_event_id)
);
```

Before processing:

```typescript
if (await eventAlreadyProcessed(provider, eventId)) {
    return;
}
```

This prevents duplicate agent executions and duplicate messages.

---

# 16. Conversation Mapping

The agent should maintain conversation context.

For example:

Discord:

```text
guild_id + channel_id + thread_id + user_id
```

Slack:

```text
team_id + channel_id + thread_ts
```

Telegram:

```text
chat_id
```

Map these into:

```text
conversationId
```

Example:

```typescript
conversationId =
  `discord:${guildId}:${channelId}:${threadId}`;
```

The same Agent runtime should then be able to retrieve conversation history.

---

# 17. Authorization

This is extremely important.

The flow must be:

```text
Platform identity
       ↓
Integration
       ↓
Our user
       ↓
Our organization
       ↓
Our permissions
       ↓
Agent
       ↓
Tools
```

Do NOT do:

```text
Discord user
   ↓
Agent
   ↓
Database
```

without authorization.

Every tool call must operate within the authenticated organization/user context.

For example:

```typescript
await agent.execute({
  organizationId: resolvedOrganizationId,
  userId: resolvedUserId,
  message
});
```

Tools should receive the same context:

```typescript
type ToolContext = {
  organizationId: string;
  userId: string;
  source: "web" | "discord" | "slack" | "telegram";
};
```

A Discord user from Organization A must never be able to access Organization B's data.

---

# 18. Dashboard UX

Build an Integrations page:

```text
Integrations

AI Agent

──────────────────────────────────

Discord

Connect your agent to a Discord server.

🟢 Connected

Acme Community

[Manage] [Disconnect]


Slack

Connect your agent to Slack.

🟢 Connected

Acme Workspace

[Manage] [Disconnect]


Telegram

Connect your agent to Telegram.

⚪ Not connected

[Connect]
```

For Discord/Slack, allow:

```text
Connected server/workspace
Channels
Allowed users/roles
Agent permissions
Disconnect
```

For Telegram:

```text
Bot
Connected account
Allowed users
Disconnect
```

---

# 19. Security Requirements

Implement all of the following:

### Secrets

Never expose:

```text
Discord Bot Token
Discord Client Secret
Slack Client Secret
Slack Access Token
Telegram Bot Token
```

to frontend code.

Use environment variables/secret manager.

### OAuth state

For Slack/Discord OAuth flows:

```text
state = cryptographically random
```

Store server-side.

Validate on callback.

Prevent CSRF.

### Token encryption

Encrypt OAuth/bot credentials at rest.

### Webhook verification

Verify every incoming platform event according to that platform's security mechanism.

### Rate limiting

Rate-limit:

```text
/webhooks/*
/agent/*
```

### Authorization

Every agent/tool request must have:

```text
organizationId
userId
permissions
```

### Audit logs

Record:

```text
organization
user
platform
channel
message/event
tool calls
actions
timestamp
```

Do not log secrets.

Be careful about logging sensitive user messages.

---

# 20. Agent Tool Architecture

Do NOT duplicate tools for each integration.

Bad:

```text
discordGetRevenue()
slackGetRevenue()
telegramGetRevenue()
webGetRevenue()
```

Good:

```text
getRevenue()
```

All interfaces call:

```text
getRevenue()
```

with:

```typescript
{
  organizationId,
  userId
}
```

The same applies to:

```text
getInvoices()
getTransactions()
searchDocuments()
createInvoice()
getCustomers()
getUsage()
getReports()
```

---

# 21. Example End-to-End Request

User sends in Discord:

```text
@Agent show me overdue invoices
```

Discord:

```text
MESSAGE_CREATE
```

Our adapter:

```typescript
const request: AgentRequest = {
  organizationId: await resolveOrganization(guildId),
  userId: await resolveUser(discordUserId),
  conversationId: `discord:${guildId}:${channelId}`,
  source: "discord",
  message: "show me overdue invoices"
};
```

Then:

```typescript
const response =
  await agentGateway.execute(request);
```

The agent decides:

```text
Need overdue invoices
        ↓
getInvoices(status="overdue")
```

Tool:

```typescript
getInvoices({
  organizationId,
  status: "overdue"
});
```

Backend returns data.

Agent generates:

```text
You have 4 overdue invoices totaling ₹2,11,500.
```

Discord adapter sends it.

---

# 22. Backend-to-Platform Notifications

Create a common notification interface:

```typescript
type Notification = {
  organizationId: string;

  provider:
    | "discord"
    | "slack"
    | "telegram";

  destinationId: string;

  text: string;
};
```

Then:

```typescript
notificationService.send(notification);
```

internally routes to:

```text
DiscordAdapter.send()
SlackAdapter.send()
TelegramAdapter.send()
```

This allows the rest of the application to remain platform-independent.

---

# 23. Final Architecture

The finished system should look like:

```text
                         YOUR PRODUCT
                              │
                     ┌────────▼────────┐
                     │   Agent Gateway │
                     └────────┬────────┘
                              │
             ┌────────────────┼────────────────┐
             │                │                │
             ▼                ▼                ▼
        Tool Registry    Conversation      Auth/RBAC
             │             Manager             │
             └────────────────┼────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │ Integration Layer │
                    └─────────┬─────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
       DiscordAdapter    SlackAdapter     TelegramAdapter
            │                 │                 │
            ▼                 ▼                 ▼
         Discord            Slack           Telegram
```

---

# 24. Implementation Order

Implement in this order:

### Phase 1

Create:

```text
AgentRequest
AgentResponse
AgentGateway
Integration model
Identity model
Event/idempotency model
```

### Phase 2

Implement Discord:

```text
OAuth/install
Guild detection
User mapping
Gateway/events
Slash command
Agent execution
Response
Disconnect detection
```

### Phase 3

Implement Slack:

```text
OAuth
Workspace mapping
User mapping
Events API/Socket Mode
Agent execution
Response
Uninstall/revocation handling
```

### Phase 4

Implement Telegram:

```text
Bot token
Webhook
Connection deep link
User mapping
Agent execution
Response
Disconnect
```

### Phase 5

Dashboard:

```text
Integrations page
Connection status
Manage
Disconnect
Channel configuration
User/role permissions
```

### Phase 6

Security/testing:

```text
OAuth CSRF
Webhook verification
Token encryption
RBAC
Cross-organization isolation
Idempotency
Rate limiting
Audit logging
```

---

# 25. Acceptance Criteria

The implementation is complete only when:

1. A user can connect Discord from the dashboard.
2. The dashboard accurately shows the connected Discord server.
3. A Discord user can interact with the existing agent.
4. The agent can fetch data from the existing backend.
5. The agent can execute existing tools.
6. Responses appear in Discord.
7. The backend can proactively send Discord notifications.
8. Removing the Discord bot marks the integration disconnected.
9. A user can connect Slack through OAuth.
10. The dashboard shows the Slack workspace.
11. Slack messages reach the same Agent Gateway.
12. Telegram can be connected through a secure deep-link flow.
13. Telegram messages reach the same Agent Gateway.
14. Discord/Slack/Telegram users map to internal users.
15. Organization isolation is enforced.
16. Tokens/secrets never reach the frontend.
17. Webhook/event retries do not execute the agent twice.
18. The same agent/tools are used regardless of the platform.
19. The dashboard can disconnect any integration.
20. All integrations have audit logs and appropriate security controls.

Do not rewrite or duplicate the existing agent implementation. Build the integrations as adapters around the existing Agent Gateway.