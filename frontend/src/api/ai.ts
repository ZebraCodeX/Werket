/**
 * AI generation API client for Werket.
 */

const API_BASE = '/api';

export interface AiGenerateRequest {
  topic: string;
  lang: 'am' | 'en';
  type: 'summary' | 'story' | 'essay' | 'outline';
}

export interface AiGenerateResponse {
  content: string;
  topic: string;
  lang: string;
  type: string;
  method: string;
}

export async function generateContent(data: AiGenerateRequest): Promise<AiGenerateResponse> {
  const res = await fetch(`${API_BASE}/ai/generate/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Generation failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}
