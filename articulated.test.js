import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScene,layoutScene,poseJoints,renderSVG,frameScene,buildPrompt } from './scene.js';
import { JOINT_NAMES } from './skeleton.js';
import { articulatedFixtures } from './articulated-fixtures.js';
import { fixtures } from './fixtures.js';
const clone=v=>JSON.parse(JSON.stringify(v));
const parse=v=>parseScene(JSON.stringify(v));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const expected=p=>JOINT_NAMES.map(name=>[p.placement.x+(p.geometry.transform?.mirrorX?-1:1)*p.geometry.joints[name][0],p.placement.y+p.geometry.joints[name][1]]);

test('geometry discriminator is required and mode combinations are unambiguous',()=>{
    for(const geometry of [{joints:articulatedFixtures.v3_custom.people[0].geometry.joints},{mode:'custom',preset:'standing',joints:{}},{mode:'preset',preset:'standing',joints:{}},{mode:'preset',preset:'crouching'}]){
        const data=clone(articulatedFixtures.v3_custom);data.people[0].geometry=geometry;assert.throws(()=>parse(data),/mode|preset/);
    }
    const custom=parse(articulatedFixtures.v3_custom);assert.equal(custom.people[0].pose,undefined);assert.equal(custom.people[0].geometry.preset,undefined);
});

test('complete asymmetric custom articulation is retained exactly, with no preset reconstruction',()=>{
    const scene=parse(articulatedFixtures.v3_custom),p=scene.people[0],j=layoutScene(scene).people[0].joints;
    assert.deepEqual(j,expected(p));
    for(const pose of ['standing','sitting','kneeling','reclining','lying'])assert.notDeepEqual(j,poseJoints(pose,{x:p.placement.x,hipY:p.placement.y}));
    near(j[4][1],320);near(j[6][1],246);near(j[8][1],420);near(j[10][1],420);assert.notEqual(j[7][1],j[9][1]);
    assert.equal(scene.people[0].geometry.mode,'custom');
});

test('single-arm overrides precede layout and protect that chain from reaching solver',()=>{
    const scene=parse(articulatedFixtures.v3_override),layout=layoutScene(scene),p=layout.people.find(p=>p.id==='alex');
    assert.deepEqual(p.joints[3],[180,289]);assert.deepEqual(p.joints[4],[155,269]);
    const base=poseJoints('standing',{x:0,hipY:0});
    for(const i of [0,1,2,7,8,9,10])assert.deepEqual(p.joints[i],[base[i][0]+220,base[i][1]+329]);
    assert.ok(layout.diagnostics.some(s=>s.includes('explicit chain retained')));
    assert.ok(Math.hypot(p.joints[6][0]-p.joints[1][0],p.joints[6][1]-p.joints[1][1])<=62.00001);
});

test('independent head-facing changes its marker without altering body or joints',()=>{
    const original=parse(articulatedFixtures.v3_custom),data=clone(articulatedFixtures.v3_custom);data.people[0].geometry.headFacing=180;data.people[0].facing='left';
    const changed=parse(data);assert.deepEqual(layoutScene(original).people[0].joints,layoutScene(changed).people[0].joints);
    assert.equal(layoutScene(changed).people[0].headAngle,180);assert.match(renderSVG(changed),/data-head-facing="180"/);assert.notEqual(renderSVG(changed),renderSVG(original));
});

test('mirroring is explicit, applies after overrides and survives export/reload',()=>{
    const original=parse(articulatedFixtures.v3_custom),descriptive=clone(original);descriptive.people[0].facing='left';
    assert.deepEqual(layoutScene(descriptive).people[0].joints,layoutScene(original).people[0].joints,'facing never mirrors custom geometry');
    const mirror=parse(articulatedFixtures.v3_mirror),a=layoutScene(original).people[0],b=layoutScene(mirror).people[0];
    a.joints.forEach(([x,y],i)=>{near(x+b.joints[i][0],800);near(y,b.joints[i][1]);});near(b.headAngle,-135);
    const override=clone(articulatedFixtures.v3_override);override.people[0].geometry.transform={mirrorX:true};assert.deepEqual(layoutScene(parse(override)).people[0].joints[4],[285,269]);
    assert.deepEqual(parse(mirror).people[0].geometry,mirror.people[0].geometry);
});

test('conflicting support preserves explicit joints; opt-in layout translates the whole figure only',()=>{
    const scene=parse(articulatedFixtures.v3_conflict),original=JSON.stringify(scene),layout=layoutScene(scene);assert.deepEqual(layout.people[0].joints,expected(scene.people[0]));
    assert.ok(layout.diagnostics.some(s=>s.includes('unresolved on-support')));assert.equal(JSON.stringify(scene),original);
    const auto=clone(scene);auto.people[0].placement.resolveRelations=true;const moved=layoutScene(auto).people[0],start=expected(auto.people[0]);
    const dx=moved.joints[0][0]-start[0][0],dy=moved.joints[0][1]-start[0][1];assert.ok(Math.hypot(dx,dy)>10);
    moved.joints.forEach(([x,y],i)=>{near(x-start[i][0],dx);near(y-start[i][1],dy);});
    const badBack=clone(scene);delete badBack.people[0].support;badBack.people[0].backSupport={target:'missing'};assert.deepEqual(layoutScene(parse(badBack)).people[0].joints,expected(scene.people[0]));
});

test('held objects follow final custom joints, including requested mirror and translation',()=>{
    for(const mirrorX of [false,true]){
        const data=clone(articulatedFixtures.v3_cup);data.people[0].geometry.transform={mirrorX};data.people[0].support={type:'on',target:'table'};data.people[0].placement.resolveRelations=true;
        const layout=layoutScene(parse(data)),person=layout.people[0],cup=layout.props.find(p=>p.id==='cup');assert.deepEqual(cup.attachment,person.joints[6]);near(cup.geometry.bounds.y+8,person.joints[6][1]);
    }
});

test('circular placement references retain explicit placement and are deterministic',()=>{
    const data=clone(articulatedFixtures.v3_override);
    for(const [i,p] of data.people.entries()){p.placement.resolveRelations=true;p.beside={target:data.people[1-i].id,side:'right'};}
    const scene=parse(data),layout=layoutScene(scene);
    for(const p of layout.people){const saved=scene.people.find(other=>other.id===p.id);near(p.x,saved.placement.x);near(p.y,saved.placement.y);}
    assert.ok(layout.diagnostics.some(s=>s.includes('circular beside')));
    const reversed=clone(scene);reversed.people.reverse();assert.equal(renderSVG(scene),renderSVG(reversed));
});

test('invalid/missing joints, numeric values, transforms and placement fail clearly without clamping',()=>{
    for(const [mutate,pattern] of [
        [p=>delete p.geometry.joints.leftKnee,/missing leftKnee/],
        [p=>p.geometry.joints.leftWrist=[0,0],/unknown joint/],
        [p=>p.geometry.joints.head=['10',0],/finite number/],
        [p=>p.geometry.joints.head=[null,0],/finite number/],
        [p=>p.geometry.joints.head=[1001,0],/not clamped/],
        [p=>p.geometry.transform={mirrorX:'yes'},/true or false/],
        [p=>p.geometry.transform={rotate:30},/only explicit mirrorX/],
        [p=>p.placement.x=2001,/not clamped/],
        [p=>delete p.placement,/must be an object/],
    ]){const data=clone(articulatedFixtures.v3_custom);mutate(data.people[0]);assert.throws(()=>parse(data),pattern);}
});

test('structurally valid unusual/off-canvas geometry renders unchanged with diagnostics, not standing',()=>{
    const data=clone(articulatedFixtures.v3_offCanvas);data.people[0].geometry.joints.leftHand=[-900,700];const scene=parse(data),layout=layoutScene(scene),frame=frameScene(layout);
    assert.deepEqual(layout.people[0].joints,expected(scene.people[0]));assert.ok(frame.x<0);assert.ok(layout.diagnostics.some(s=>s.includes('without repair')));assert.ok(renderSVG(scene).includes('viewBox='));
});

test('ignored pose-related fields are reported; unsupported preset/modifier values never normalize silently',()=>{
    const data=clone(articulatedFixtures.v3_custom);data.people[0].pose='crouching';data.people[0].armOverrides={near:'raised'};data.people[0].geometry.scale=2;
    const scene=parse(data);assert.ok(scene.warnings.some(s=>s.includes('.pose')));assert.ok(scene.warnings.some(s=>s.includes('.armOverrides')));assert.ok(scene.warnings.some(s=>s.includes('.scale')));assert.deepEqual(layoutScene(scene).people[0].joints,expected(scene.people[0]));
    data.people[0].arms='waving';assert.throws(()=>parse(data),/unsupported/);
});

test('JSON save/export/reload, SVG export and repeated rendering retain original custom payload',()=>{
    for(const fixture of Object.values(articulatedFixtures)){
        const scene=parse(fixture),stored=JSON.stringify(scene),reloaded=parse(JSON.parse(stored));assert.deepEqual(reloaded,scene);
        for(const view of ['side','top-down']){
            const svg=renderSVG(scene,view);assert.equal(svg,renderSVG(reloaded,view));assert.equal(svg,renderSVG(scene,view));assert.equal(JSON.stringify(scene),stored);
            const layout=layoutScene(scene,view),frame=frameScene(layout);for(const r of frame.shapes)assert.ok(r.x>=frame.x && r.y>=frame.y && r.x+r.w<=frame.x+frame.width && r.y+r.h<=frame.y+frame.height);
        }
    }
    const legacy=parse(fixtures.G);assert.deepEqual(legacy.people[0].joints,fixtures.G.people[0].joints);assert.equal(parse(fixtures.C).schemaVersion,2);
});

test('overhead uses separately supplied layout data, never a custom skeleton projection',()=>{
    const data=parse(articulatedFixtures.v3_custom),layout=layoutScene(data,'top-down');assert.equal(layout.people[0].depth,260);assert.match(renderSVG(data,'top-down'),/not an overhead projection/);
    const changed=clone(data);changed.people[0].geometry.joints.rightHand=[700,-500];assert.equal(renderSVG(data,'top-down'),renderSVG(changed,'top-down'));
    const unknown=clone(data);delete unknown.people[0].placement.depth;assert.ok(layoutScene(unknown,'top-down').diagnostics.some(s=>s.includes('depth unspecified')));
    const prompt=buildPrompt('A crouch.','side');assert.ok(prompt.includes('mode:"custom"'));assert.ok(prompt.includes('mode:"preset"'));assert.ok(prompt.includes('leftHand'));assert.ok(!prompt.includes('No arbitrary joint coordinates'));
});
