import Groq from 'groq-sdk'
import { NextRequest, NextResponse } from 'next/server'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { messages, systemPrompt } = await req.json()

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 400,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ]
    })

    const text = response.choices[0]?.message?.content ?? "I'm here 🧡"
    return NextResponse.json({ text })

  } catch (error) {
    console.error('API route error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}