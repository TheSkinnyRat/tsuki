# Tsuki

A Discord music bot that plays through **the Lavalink node you bring**, with a
web dashboard that can do everything the slash commands can.

Most public music bots run audio on infrastructure you do not control, and stop
working when that infrastructure does. Tsuki turns that around: a server points
Tsuki at its own Lavalink node, and what the bot can play is whatever that node
supports.

> **Status: in development.** Nothing here is ready to invite yet.

## What it is

- **Bring your own node.** Each guild stores its own Lavalink v4 credentials.
  Several nodes per guild, with failover between them.
- **Honest capabilities.** When a node is saved, Tsuki reads its `GET /v4/info`
  and shows exactly which sources, plugins and filters it has. A request for a
  source the node lacks is refused up front with a reason, not as a load error.
- **Dashboard parity.** Every action exists as a slash command *and* on the web
  dashboard, because both call the same service layer inside the bot. The
  dashboard is a remote control — audio always plays in the Discord voice
  channel.

## Repository layout

```
apps/bot          Discord bot: service layer, slash commands, internal HTTP API
apps/web          Next.js dashboard (Discord OAuth)
packages/db       Prisma schema and client
packages/shared   Types shared across processes, crypto, host safety checks
tools/audio-probe Development instrument: proves audio really reaches a channel
```

## Development

Requirements: Node 22+, pnpm 10+, a Lavalink v4 node, and Java 17+ if you run
that node yourself.

```bash
pnpm install
cp .env.example .env        # then fill DISCORD_TOKEN and the secrets
pnpm db:push
pnpm dev:bot                # the Discord bot
pnpm dev:web                # the dashboard, on http://127.0.0.1:3860
```

Register the slash commands once, in a test guild so they appear immediately:

```bash
pnpm --filter @tsuki/bot run deploy-commands <guild id>
```

### Opening the dashboard without an OAuth application

Setting up Discord OAuth just to look at a queue is a lot of ceremony. Set
`DEV_LOGIN=1` and the sign-in page gains a field that takes a Discord user id
directly. It grants nothing the real login would not — the bot still decides
every permission from that id — and it cannot exist in a deployed build,
because `next build` sets `NODE_ENV=production` and the provider is only
registered when that is not the case.

### Proving audio actually arrives

`tools/audio-probe` joins a voice channel as a second bot and counts the Opus
packets the music bot transmits. Discord's silence frame is three bytes, so
anything larger is real sound — which answers "is there audio in the room"
without an Opus decoder, and without trusting Lavalink's own word for it.

```bash
cd tools/audio-probe
node --env-file=../../.env src/index.ts <guild id> <voice channel id> 30
```

### Three rules that are easy to break

**The database schema stays in the subset SQLite and PostgreSQL share.** No
`enum`, no scalar lists, no `Json`. That is what keeps `provider` a one-line
change; the migration history still has to be regenerated when you switch.

**No TypeScript that needs more than type stripping.** The bot runs its sources
directly on Node, which strips types rather than compiling them — so no `enum`,
no `namespace`, and no constructor parameter properties. Relative imports carry
their `.ts` extension.

**A permission is decided in `apps/bot/src/core/permissions.ts` and nowhere
else.** Both the slash commands and the dashboard's API call it, and the rule
never reads which surface the request came from. Enforcing something in a
command handler instead means enforcing it on Discord and leaving it open on
the web.

## Licence

[AGPL-3.0-only](./LICENSE). You may run, modify and self-host Tsuki. If you run
a modified version as a service for other people, those changes have to be
published too.
