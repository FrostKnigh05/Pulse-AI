# Server Analytics & Memory Bot

A Discord bot that tracks simple server analytics and stores guild-specific memory notes.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `config.json` in the project root using the example below.

```json
{
  "token": "YOUR_DISCORD_BOT_TOKEN",
  "prefix": "!"
}
```

3. Run the bot:

```bash
npm start
```

## Commands

- `!help` — Show available commands.
- `!analytics overview` — Show server analytics counts.
- `!analytics channels` — Show message counts by channel.
- `!analytics reset` — Reset analytics data (requires Manage Server permission).
- `!memory set <key> <value>` — Save a memory note for the server.
- `!memory get <key>` — Retrieve a saved memory note.
- `!memory delete <key>` — Delete a saved memory note.
- `!memory list` — List all saved memory keys.

## Notes

- Analytics and memory are stored in `data.json`.
- Keep `config.json` secret and never publish your bot token.
