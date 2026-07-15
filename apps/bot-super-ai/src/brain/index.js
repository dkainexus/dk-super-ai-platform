const Anthropic = require("@anthropic-ai/sdk");
const { createLogger } = require("@dk/shared");
const tools = require("../tools");

const log = createLogger("bot-super-ai");
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";
const MAX_STEPS = 4;

async function runBrain(userText, { lastPhotoFileId } = {}) {
  const system = [
    "你是 DK Super AI，一个通过 Telegram 调度多个业务 bot 的内部运营助手。",
    "只对已授权的 ceo/coo 员工开放，收到指令后判断需要哪个工具、调用它，再用一两句话汇报结果。",
    lastPhotoFileId
      ? `该员工最近发送过一张图片，file_id: ${lastPhotoFileId}`
      : "该员工目前没有发送过图片。",
  ].join("\n");

  const messages = [{ role: "user", content: userText }];

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages,
      tools: tools.definitions,
    });

    if (response.stop_reason !== "tool_use") {
      return response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n");
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const handler = tools.handlers[block.name];
      let result;
      try {
        result = handler ? await handler(block.input) : { ok: false, message: "unknown tool" };
      } catch (err) {
        log.error(`tool ${block.name} failed:`, err.message);
        result = { ok: false, message: err.message };
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return "任务步骤太多，请把指令拆分得更具体一些。";
}

module.exports = { runBrain };
