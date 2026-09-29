import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage
} from 'ai'
import { corpus } from './corpus'

// Maximum reasoning can take minutes on a hard question.
export const maxDuration = 300

const MODEL = 'openai/gpt-6-luna'
const MAX_MESSAGES = 40
const MAX_MESSAGE_CHARS = 8000

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  appName: 'Nio documentation',
  appUrl: 'https://nio-lang.org'
})

const INSTRUCTIONS = `You are the assistant on the documentation site of Nio (https://nio-lang.org), a statically typed language that compiles to native code and is aimed at back-end services.

Nio is young. You have no reliable knowledge of it from training, and it is not Go, Rust, TypeScript or Swift even where it looks similar. The documentation and example programs below are the only source of truth:
- Answer from them. Use only the syntax, keywords, modules and functions they show.
- If they do not cover what the user asks, say so plainly and give the closest thing they do cover. Never invent a function, a module, an option or a syntax.
- Before you give code, check each call against the documentation: its module must be imported, its name and arguments must match, and fallible calls must be handled the way the Errors page describes.

How to answer:
- For a "how do I" question, lead with a short, complete, runnable program or snippet, then explain the parts that are not obvious.
- Put Nio code in \`\`\`nio fences, shell commands in \`\`\`sh fences.
- Link to the pages you used with relative Markdown links, for example [HTTP](/docs/stdlib/http) or [Errors](/docs/errors#catching-a-block). Use only the URLs of the pages below.
- Be concise. Use headings only for long answers.
- If a question is not about Nio or programming with it, say briefly that you only help with Nio.`

type Body = { messages?: unknown; page?: unknown }

// Keeps only the text of user and assistant messages, so a client cannot
// send a system message or other part types.
function clean(messages: unknown): UIMessage[] | null {
  if (!Array.isArray(messages) || messages.length === 0) return null
  const out: UIMessage[] = []
  for (const m of messages.slice(-MAX_MESSAGES)) {
    if (m?.role !== 'user' && m?.role !== 'assistant') return null
    const text = (Array.isArray(m.parts) ? m.parts : [])
      .filter(p => p?.type === 'text' && typeof p.text === 'string')
      .map(p => p.text)
      .join('')
    if (text.length > MAX_MESSAGE_CHARS && m.role === 'user') return null
    if (text.trim() === '') continue
    out.push({ id: String(m.id ?? out.length), role: m.role, parts: [{ type: 'text', text }] })
  }
  return out.at(-1)?.role === 'user' ? out : null
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }
  const messages = clean(body.messages)
  if (!messages) return new Response('Invalid messages', { status: 400 })

  const page =
    typeof body.page === 'string' && /^\/[\w\-/#]{0,200}$/.test(body.page) ? body.page : null

  // The page line comes after the documentation so that the long prefix
  // stays the same for every request.
  const instructions =
    `${INSTRUCTIONS}\n\n${corpus()}` +
    (page ? `\n\nThe user is reading ${page}. Questions such as "this page" or "this function" refer to it.` : '')

  const result = streamText({
    model: openrouter(MODEL),
    instructions,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 128000,
    providerOptions: {
      openrouter: { reasoning: { effort: 'xhigh' } }
    },
    abortSignal: req.signal
  })

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      sendReasoning: true,
      onError: () => 'The assistant could not answer. Try again in a moment.'
    })
  })
}
