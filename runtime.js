// Pure helpers shared by the UI and regression tests.
export const KEY = 'bluewaters_scene_sketch';
export const messageCount = value => Math.max(1, Math.min(12, Math.floor(Number(value) || 4)));

export function buildExcerpt(chat, count) {
    const messages = chat.filter(m => !m.is_system && typeof m.mes === 'string').slice(-messageCount(count));
    if (!messages.length) throw Error('Open a chat with at least one message first.');
    // Keep valid JSON, speaker boundaries, and the latest text, even with escaping.
    const result = messages.map(m => ({ name: String(m.name ?? '').slice(0, 160), text: m.mes }));
    while (JSON.stringify(result).length > 12000) {
        if (result.length > 1) { result.shift(); continue; }
        const item = result[0];
        let lo = 0, hi = item.text.length;
        const original = item.text;
        while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            item.text = original.slice(-mid);
            if (JSON.stringify(result).length <= 12000) lo = mid;
            else hi = mid - 1;
        }
        item.text = lo ? original.slice(-lo) : '';
        // Do not start at the trailing half of a surrogate pair.
        if (/^[\uDC00-\uDFFF]/.test(item.text)) item.text = item.text.slice(1);
    }
    return JSON.stringify(result);
}

const identity = c => JSON.stringify([c.characterId ?? null, c.groupId ?? null, c.chatId ?? null]);
const fingerprint = c => JSON.stringify(c.chat.map(m => [m.name, m.mes, m.swipe_id, m.is_system, m.is_user]));
export function captureChat(context, revision) {
    if (context.chatId == null || context.chatId === '') throw Error('Open a saved character or group chat first.');
    return { chat: context.chat, metadata: context.chatMetadata, identity: identity(context), fingerprint: fingerprint(context), revision };
}
export function isCurrentChat(snapshot, context, revision) {
    return snapshot.revision === revision && snapshot.chat === context.chat && snapshot.metadata === context.chatMetadata
        && snapshot.identity === identity(context) && snapshot.fingerprint === fingerprint(context);
}
