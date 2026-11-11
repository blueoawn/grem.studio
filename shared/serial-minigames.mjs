/**
 * Resolve a GameEmbed against its current row from the public approved_minigames
 * view. Pass undefined when the view has no matching row or could not be read.
 * A reader can use the same unavailable descriptor if its iframe fails later.
 */
export async function resolveMinigameEmbed(node, approvedGame, request = globalThis.fetch) {
  const { id, title, width, height } = node;
  const unavailable = { status: 'unavailable', id, title, width, height };
  if (!approvedGame || approvedGame.embedId !== node.embed_id.trim()) {
    return unavailable;
  }

  const url = new URL(approvedGame.path, approvedGame.origin);
  const keys = new Set();
  for (const param of node.params ?? []) {
    const key = param.key.trim();
    const value = param.value.trim();
    const rule = approvedGame.allowedParams.find((entry) => entry.key === key);
    if (keys.has(key) || !rule?.values.includes(value)) {
      return unavailable;
    }
    keys.add(key);
    url.searchParams.append(key, value);
  }

  try {
    const response = await request(url, {
      method: 'HEAD',
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    const type = response.headers.get('content-type')?.split(';', 1)[0].trim();
    if (response.status !== 200 || response.redirected || type !== 'text/html') {
      return unavailable;
    }
  } catch {
    return unavailable;
  }

  return {
    status: 'ready',
    id,
    title,
    width,
    height,
    src: url.href,
    sandbox: approvedGame.policy.sandbox,
    allow: approvedGame.policy.allow,
    referrerPolicy: 'no-referrer',
  };
}
