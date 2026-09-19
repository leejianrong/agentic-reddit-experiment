/**
 * Cheap open-weight models don't reliably honor "output ONLY JSON" the way
 * Claude's native structured outputs did — this pulls a JSON object out of
 * a response even when it's wrapped in a code fence or has stray prose
 * around it. Returns undefined (never throws) if nothing parses.
 */
export function extractJsonObject(text: string): unknown {
  const attempts = [text.trim(), stripCodeFence(text), extractBraces(text)];

  for (const candidate of attempts) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next candidate
    }
  }
  return undefined;
}

function stripCodeFence(text: string): string | undefined {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return match?.[1]?.trim();
}

function extractBraces(text: string): string | undefined {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return undefined;
  }
  return text.slice(start, end + 1);
}
