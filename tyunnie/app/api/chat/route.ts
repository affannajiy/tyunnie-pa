import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { messages, systemPrompt } = await req.json()

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 400,
    system: systemPrompt,
    messages
  })

  // Find the first text block — narrows the type so TypeScript is happy
  const textBlock = response.content.find(block => block.type === 'text')

  if (!textBlock || textBlock.type !== 'text') {
    return NextResponse.json({ error: 'No text response from AI' }, { status: 500 })
  }

  return NextResponse.json({ text: textBlock.text })
}