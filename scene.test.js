import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScene, renderSVG, buildPrompt } from './scene.js';
const sample=()=>({title:'Test',people:[{name:'A',joints:Array.from({length:11},(_,i)=>[100+i,100+i])}],props:[]});
test('accepts fenced JSON and bounds coordinates',()=>{const s=sample();s.people[0].joints[0]=[-500,900];assert.deepEqual(parseScene('```json\n'+JSON.stringify(s)+'\n```').people[0].joints[0],[12,470]);});
test('escapes injected model markup',()=>{const s=sample();s.people[0].name='<script>alert(1)</script>';const svg=renderSVG(parseScene(JSON.stringify(s)));assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('&lt;script&gt;'));});
test('rejects malformed skeletons, huge responses and nonnumeric coordinates',()=>{for(const mutate of [s=>s.people[0].joints.pop(),s=>s.people[0].joints[0]=['0',1],s=>s.people=[]]){const s=sample();mutate(s);assert.throws(()=>parseScene(JSON.stringify(s)));}assert.throws(()=>parseScene(' '.repeat(60001)));});
test('production prompt offers presets, overrides and complete custom skeletons in one response',()=>{const p=buildPrompt('Alice sits.','side');assert.ok(p.includes('schemaVersion 3'));assert.ok(p.includes('interpretation'));assert.ok(p.includes('mode:"preset"'));assert.ok(p.includes('mode:"custom"'));assert.ok(p.includes('No preset required'));assert.ok(p.includes('headFacing'));assert.ok(p.includes('SCENE:\nAlice sits.\nEND SCENE'));});

test('prop extents stay inside the canvas and reject nonfinite coordinates',()=>{
    const s=sample();s.props=[{name:'edge',x:999,y:999,w:999,h:999}];
    assert.deepEqual(parseScene(JSON.stringify(s)).props[0],{name:'edge',x:790,y:490,w:10,h:10});
    s.props[0].w='10';assert.throws(()=>parseScene(JSON.stringify(s)));
});

test('null roots and members produce validation errors',()=>{
    assert.throws(()=>parseScene('null'),/Expected 1–8 people/);
    const s=sample();s.people=[null];assert.throws(()=>parseScene(JSON.stringify(s)),/11 joints/);
    s.people=sample().people;s.props=[null];assert.throws(()=>parseScene(JSON.stringify(s)),/Invalid prop/);
});
