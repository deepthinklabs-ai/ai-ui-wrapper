/**
 * ElevenLabs Text-to-Speech API Route
 *
 * Provides realistic AI-generated speech using ElevenLabs API
 */

import { NextRequest, NextResponse } from 'next/server';

// SECURITY: Validate voiceId to prevent SSRF attacks
// ElevenLabs voice IDs are alphanumeric strings (e.g., 'EXAVITQu4vr4xnSDxMaL')
const VOICE_ID_PATTERN = /^[a-zA-Z0-9]{10,30}$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voiceId = 'EXAVITQu4vr4xnSDxMaL' } = body; // Default: Sarah voice

    console.log('[ElevenLabs API] Received TTS request - Text length:', text?.length, 'Voice ID:', voiceId);
    console.log('[ElevenLabs API] Text preview:', text?.substring(0, 200));

    if (!text) {
      return NextResponse.json(
        { error: 'Missing text parameter' },
        { status: 400 }
      );
    }

    // SECURITY: Validate voiceId format to prevent SSRF
    if (!voiceId || typeof voiceId !== 'string' || !VOICE_ID_PATTERN.test(voiceId)) {
      return NextResponse.json(
        { error: 'Invalid voice ID format' },
        { status: 400 }
      );
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    // Call ElevenLabs API (voiceId validated above)
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('ElevenLabs API error:', errorData);
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    // Get the audio data
    const audioBuffer = await response.arrayBuffer();

    // Return the audio as base64
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    return NextResponse.json({
      audio: base64Audio,
      contentType: 'audio/mpeg',
    });
  } catch (error: any) {
    console.error('Error in /api/tts/elevenlabs:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
