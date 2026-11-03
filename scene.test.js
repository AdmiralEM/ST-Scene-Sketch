import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScene, renderSVG, buildPrompt } from './scene.js';
const sample=()=>({title:'Test',people:[{name:'A',joints:Array.from({length:11},(_,i)=>[100+i,100+i])}],props:[]});
test('accepts fenced JSON and bounds coordinates',()=>{const s=sample();s.people[0].joints[0]=[-500,900];assert.deepEqual(parseScene('```json\n'+JSON.stringify(s)+'\n```').people[0].joints[0],[12,470]);});
test('escapes injected model markup',()=>{const s=sample();s.people[0].name='<script>alert(1)</script>';const svg=renderSVG(parseScene(JSON.stringify(s)));assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('&lt;script&gt;'));});
test('rejects malformed skeletons, huge responses and nonnumeric coordinates',()=>{for(const mutate of [s=>s.people[0].joints.pop(),s=>s.people[0].joints[0]=['0',1],s=>s.people=[]]){const s=sample();mutate(s);assert.throws(()=>parseScene(JSON.stringify(s)));}assert.throws(()=>parseScene(' '.repeat(60001)));});
test('prompt includes skeleton and scene boundaries',()=>{const p=buildPrompt('Alice sits.','side');assert.ok(p.includes('leftElbow'));assert.ok(p.includes('SCENE:\nAlice sits.\nEND SCENE'));});
