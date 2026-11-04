import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExcerpt, messageCount, captureChat, isCurrentChat } from './runtime.js';

test('message selection is integer bounded and excludes system messages', () => {
    assert.equal(messageCount(2.8), 2);
    assert.equal(messageCount(Infinity), 12);
    assert.equal(messageCount(-1), 1);
    assert.equal(messageCount('bad'), 4);
    assert.deepEqual(JSON.parse(buildExcerpt([{ name:'A', mes:'old' }, { is_system:true, mes:'secret' }, { name:'B', mes:'new' }], 1)), [{ name:'B', text:'new' }]);
    assert.throws(() => buildExcerpt([], 4));
});

test('large escaped excerpts remain valid bounded JSON with the newest text', () => {
    const source=buildExcerpt([{name:'Old',mes:'old'}, {name:'A',mes:'😀"\\\n'.repeat(10000)+'latest'}], 12);
    assert.ok(source.length <= 12000);
    const messages=JSON.parse(source);
    assert.equal(messages.length,1);
    assert.equal(messages[0].name,'A');
    assert.ok(messages[0].text.endsWith('latest'));
    assert.ok(!/^[\uDC00-\uDFFF]/.test(messages[0].text));
});

test('identity, metadata, text, swipe, role and event revisions invalidate a request', () => {
    const fresh=()=>({characterId:0,groupId:null,chatId:'chat',chat:[{name:'A',mes:'Hi',swipe_id:0}],chatMetadata:{}});
    for (const mutate of [c=>c.chatId='other',c=>c.characterId=1,c=>c.groupId='group',c=>c.chat=[],c=>c.chatMetadata={},c=>c.chat[0].mes='edit',c=>c.chat[0].swipe_id=1,c=>c.chat[0].is_system=true]) {
        const c=fresh(), snapshot=captureChat(c,0);
        assert.ok(isCurrentChat(snapshot,c,0));
        mutate(c);
        assert.equal(isCurrentChat(snapshot,c,0),false);
    }
    const c=fresh(), snapshot=captureChat(c,0);
    assert.equal(isCurrentChat(snapshot,c,2),false); // switch away and back / edit and undo
    assert.throws(()=>captureChat({...c,chatId:undefined},0));
});
