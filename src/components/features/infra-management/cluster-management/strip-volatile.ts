// kubectl apply 가 무시하는 server-managed 필드. 편집/복사 시 사용자 혼선 방지로 미리 제거.
const STRIP_TOP = new Set(['status']);
const STRIP_META = new Set([
  'uid',
  'resourceVersion',
  'selfLink',
  'creationTimestamp',
  'generation',
  'managedFields',
  'ownerReferences',
  'finalizers',
]);

export const stripVolatile = (raw: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (STRIP_TOP.has(k)) continue;
    if (k === 'metadata' && v && typeof v === 'object') {
      const meta: Record<string, unknown> = {};
      for (const [mk, mv] of Object.entries(v as Record<string, unknown>)) {
        if (STRIP_META.has(mk)) continue;
        meta[mk] = mv;
      }
      out[k] = meta;
      continue;
    }
    out[k] = v;
  }
  return out;
};