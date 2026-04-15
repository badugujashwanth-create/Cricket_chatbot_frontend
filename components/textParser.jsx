function normalizeEntityValue(value = '') {
  return String(value || '').trim().toLowerCase();
}

function escapeEntityPattern(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseTextWithEntities(text = '', entities = []) {
  const source = String(text || '');
  const cleanEntities = [
    ...new Set(
      (Array.isArray(entities) ? entities : [])
        .map((entity) => String(entity || '').trim())
        .filter(Boolean)
    )
  ].sort((left, right) => right.length - left.length);

  if (!source || !cleanEntities.length) {
    return [{ type: 'text', value: source }];
  }

  const entityLookup = cleanEntities.reduce((accumulator, entity) => {
    accumulator[normalizeEntityValue(entity)] = entity;
    return accumulator;
  }, {});
  const pattern = new RegExp(`(${cleanEntities.map(escapeEntityPattern).join('|')})`, 'gi');
  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    const [value] = match;
    const startIndex = match.index;

    if (startIndex > lastIndex) {
      segments.push({
        type: 'text',
        value: source.slice(lastIndex, startIndex)
      });
    }

    segments.push({
      type: 'entity',
      value,
      entity: entityLookup[normalizeEntityValue(value)] || value
    });

    lastIndex = startIndex + value.length;
  }

  if (lastIndex < source.length) {
    segments.push({
      type: 'text',
      value: source.slice(lastIndex)
    });
  }

  return segments.length ? segments : [{ type: 'text', value: source }];
}
