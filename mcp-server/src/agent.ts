import Anthropic from "@anthropic-ai/sdk";
import { TOOLS } from "./tools";
import { makeApiClient } from "./gembala-api";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface AgentContext {
  userId: string;
  churchId: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
}

export async function processMessage(
  userMessage: string,
  ctx: AgentContext
): Promise<string> {
  const api = makeApiClient(ctx.userId, ctx.churchId);

  const messages: Anthropic.MessageParam[] = [
    ...ctx.conversationHistory.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  const systemPrompt = `You are Gembala's AI assistant for church leaders. You help with:
- Recording attendance for small group sessions
- Querying member information (scoped to your access)
- Adding pastoral notes
- Reporting on absences and follow-up needs

Always confirm with the user before writing data (attendance, notes).
For ambiguous member names, list matches and ask for clarification.
Respond concisely. The user is a church leader communicating via Telegram.`;

  let response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    tools: TOOLS,
    messages,
  });

  // Agentic loop
  while (response.stop_reason === "tool_use") {
    const assistantMessage: Anthropic.MessageParam = {
      role: "assistant",
      content: response.content,
    };
    messages.push(assistantMessage);

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type !== "tool_use") continue;

      let result: string;
      try {
        const input = block.input as Record<string, unknown>;
        switch (block.name) {
          case "list_members":
            result = JSON.stringify(await api.listMembers(input as Record<string, string>));
            break;
          case "get_member": {
            const nameOrId = input.name_or_id as string;
            // Try by ID first, else search by name
            if (/^[0-9a-f-]{36}$/.test(nameOrId)) {
              result = JSON.stringify(await api.getMember(nameOrId));
            } else {
              const members = await api.listMembers({ q: nameOrId }) as unknown[];
              result = JSON.stringify(members);
            }
            break;
          }
          case "list_sessions":
            result = JSON.stringify(await api.listSessions(input.group_id as string));
            break;
          case "create_session":
            result = JSON.stringify(
              await api.createSession(input.group_id as string, {
                sessionDate: input.session_date,
                topic: input.topic,
              })
            );
            break;
          case "record_attendance":
            result = JSON.stringify(
              await api.recordAttendance(
                input.group_id as string,
                input.session_id as string,
                { records: input.records, source: "telegram" }
              )
            );
            break;
          case "add_pastoral_note":
            result = JSON.stringify(
              await api.addPastoralNote(input.member_id as string, {
                bodyHtml: input.body,
                source: "telegram",
              })
            );
            break;
          case "get_absence_report":
            result = JSON.stringify(await api.getAbsenceReport());
            break;
          case "get_birthdays":
            result = JSON.stringify(await api.getBirthdays(input.days as number | undefined));
            break;
          default:
            result = JSON.stringify({ error: "Unknown tool" });
        }
      } catch (err) {
        result = JSON.stringify({ error: String(err) });
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result,
      });
    }

    messages.push({ role: "user", content: toolResults });

    response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    });
  }

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text : "Sorry, I couldn't process that.";
}
