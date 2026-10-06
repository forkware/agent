import { definePlugin } from "#sdk/server";

export default definePlugin((ctx) => {
  ctx.agents.registerProvider({
    id: "claude-code",
    label: "Claude Code",
    command: "claude",
    // A prompt as the first argument starts an interactive session with that message.
    args: ({ prompt }) => (prompt ? [prompt] : []),
  });
});
