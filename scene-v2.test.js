import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScene,renderSVG,poseJoints,layoutScene,frameScene } from './scene.js';
import { fixtures } from './fixtures.js';
const parse=data=>parseScene(JSON.stringify(data));
const clone=data=>JSON.parse(JSON.stringify(data));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

test('all five poses mirror coherently and preserve limb lengths',()=>{
    for(const pose of ['standing','sitting','kneeling','reclining','lying'])for(const lean of ['upright','forward','backward'])for(const arms of ['resting','reaching','raised']){
        const right=poseJoints(pose,{x:400,dir:1,lean,arms}),left=poseJoints(pose,{x:400,dir:-1,lean,arms});
        right.forEach((point,i)=>{near(point[0]-400,400-left[i][0]);near(point[1],left[i][1]);});
        near(distance(right[1],right[2]),66);
        for(const [a,b] of [[2,7],[7,8],[2,9],[9,10]])near(distance(right[a],right[b]),46);
        for(const [a,b] of [[1,3],[1,5]])near(distance(right[a],right[b]),34);
        for(const [a,b] of [[3,4],[5,6]])near(distance(right[a],right[b]),32);
    }
});

test('kneeling, sitting, reclining and lying have distinct semantic geometry',()=>{
    const kneel=poseJoints('kneeling'),sit=poseJoints('sitting'),stand=poseJoints('standing'),recline=poseJoints('reclining'),lie=poseJoints('lying');
    near(kneel[7][1],420);near(kneel[10][1],420);near(kneel[8][1],420);
    assert.ok(kneel[2][1]>stand[2][1]+40);
    near(sit[2][1],sit[7][1]);assert.ok(sit[7][0]>sit[2][0]+40);near(sit[8][1],420);
    assert.ok(Math.abs(recline[0][0]-recline[2][0])>60);assert.ok(recline[0][1]<recline[2][1]-30);
    near(lie[1][1],lie[2][1]);assert.ok(Math.abs(lie[0][0]-lie[2][0])>80);near(lie[0][1]+12,420);
});

test('explicit seat/bed support attaches hips and low seats do not push feet below ground',()=>{
    const b=parse(fixtures.B),layout=layoutScene(b),alex=layout.people[0],chair=layout.props.find(p=>p.id==='chair');
    near(alex.joints[2][1],chair.geometry.top.y);near(alex.x,(chair.geometry.top.x1+chair.geometry.top.x2)/2);near(alex.joints[8][1],420);
    const low=clone(fixtures.B);low.props[0].y=410;
    const lowPerson=layoutScene(parse(low)).people[0];near(lowPerson.joints[8][1],420);near(distance(lowPerson.joints[7],lowPerson.joints[8]),46);
    const d=layoutScene(parse(fixtures.D)),lying=d.people.find(p=>p.id==='alex');
    near(lying.joints[2][1]+4,d.props[0].y);near(lying.joints[0][1]+12,d.props[0].y);assert.ok(lying.joints[0][0]>d.props[0].x);
});

test('stone against-support differs from sitting on it; nearby kneeling/reaching never snaps to contact',()=>{
    const c=layoutScene(parse(fixtures.C)),alex=c.people.find(p=>p.id==='alex'),sam=c.people.find(p=>p.id==='sam'),stone=c.props.find(p=>p.id==='rock');
    assert.ok(alex.backUsed);near(alex.joints[2][1],416);assert.ok(alex.joints[2][1]>stone.geometry.top.y);near(sam.joints[7][1],420);near(sam.x,alex.x+140);
    assert.equal(sam.dir,-1);assert.ok(sam.joints[4][0]<sam.joints[1][0]);
    assert.ok(distance(sam.joints[1],sam.joints[4])<66); // bounded reach, not target snapping
    const unrelated=clone(fixtures.B);delete unrelated.people[0].support;unrelated.people[0].x=300;
    unrelated.props[0].y=300;const figure=layoutScene(parse(unrelated)).people[0];near(figure.joints[2][1],374);
});

test('relationships, fallback layout and colors do not depend on object iteration order',()=>{
    for(const key of ['A','B','C','D','E','F']){
        const data=clone(fixtures[key]),normal=parse(data);data.people.reverse();data.props.reverse();
        assert.deepEqual(layoutScene(normal),layoutScene(parse(data)));
        assert.equal(renderSVG(normal),renderSVG(parse(data)));
    }
    const fallback=layoutScene(parse(fixtures.F));
    assert.ok(fallback.diagnostics.some(s=>s.includes('circular')));
    assert.ok(fallback.diagnostics.some(s=>s.includes('conflicting')));
    assert.ok(fallback.diagnostics.some(s=>s.includes('missing')));
    assert.ok(fallback.diagnostics.some(s=>s.includes('unknown value')));
    assert.equal(fallback.props[0].type,'box');
});

test('unsupported support relationships fall back without treating water as a seat',()=>{
    const invalid=clone(fixtures.C);invalid.people[0].support={type:'on',target:'pool'};
    const layout=layoutScene(parse(invalid));assert.equal(layout.people[0].supportUsed,false);assert.ok(layout.diagnostics.some(s=>s.includes('invalid or missing solid support')));
    invalid.people[0].support={type:'on',target:'missing'};assert.equal(layoutScene(parse(invalid)).people[0].supportUsed,false);
    delete invalid.people[0].support.target;assert.ok(parse(invalid).warnings.some(s=>s.includes('missing or invalid target')));
    invalid.people[0].support={type:'unrecognized',target:'rock'};assert.equal(parse(invalid).people[0].support,undefined);
    delete invalid.people[0].pose;assert.ok(parse(invalid).warnings.some(s=>s.includes('missing value; using standing')));
});

test('caption and assumptions have separate sensible limits with explicit errors, never fragments',()=>{
    const data=clone(fixtures.C);data.interpretation='A complete sentence with useful detail. '.repeat(10);data.assumptions=['An assumption longer than a generic label. '.repeat(8)];
    const parsed=parse(data);assert.equal(parsed.interpretation,data.interpretation.trim());assert.equal(parsed.assumptions[0],data.assumptions[0].trim());
    data.interpretation='x'.repeat(601);assert.throws(()=>parse(data),/Scene interpretation exceeds 600.*not truncated/);
    data.interpretation='Valid.';data.assumptions=['x'.repeat(601)];assert.throws(()=>parse(data),/Assumption exceeds 600/);
});

test('invalid versions, duplicate IDs, numeric values and scriptable text are safely handled',()=>{
    const data=clone(fixtures.B);data.schemaVersion=99;assert.throws(()=>parse(data),/schema version/);
    data.schemaVersion=2;data.people[0].id='chair';assert.throws(()=>parse(data),/unique/);
    data.people[0].id='alex';data.props[0].x='10';assert.throws(()=>parse(data),/finite/);
    data.props[0].x=240;data.people[0].name='<script>alert(1)</script>';data.interpretation='<img src=x onerror=alert(1)> is story text.';
    data.props[0].path='<script>';data.props[0].url='javascript:alert(1)';
    const parsed=parse(data),svg=renderSVG(parsed);assert.ok(!svg.includes('<script>'));assert.ok(!svg.includes('<img'));assert.ok(svg.includes('&lt;img'));assert.equal(parsed.props[0].path,undefined);
    data.people[0].name='bad\u0000text';assert.throws(()=>parse(data),/unsupported text/);
});

test('framing covers each geometry/label bound in both views and trims fixed-canvas whitespace',()=>{
    for(const data of Object.values(fixtures))for(const view of ['side','top-down']){
        const parsed=parse(data),layout=layoutScene(parsed,view),frame=frameScene(layout),svg=renderSVG(parsed,view);
        assert.ok(frame.width>=360 && frame.height>=240);
        for(const r of frame.shapes){assert.ok(r.x>=frame.x && r.y>=frame.y);assert.ok(r.x+r.w<=frame.x+frame.width && r.y+r.h<=frame.y+frame.height);}
        assert.ok(svg.includes(`viewBox="${frame.x} ${frame.y} ${frame.width} ${frame.height}"`));
        assert.equal(svg,renderSVG(parse(parsed),view),'JSON export/reload preserves framing and geometry');
    }
    const frame=frameScene(layoutScene(parse(fixtures.A)));assert.ok(frame.y>100,'frame starts near content rather than empty canvas top');assert.ok(frame.height<400);
});

test('overhead is position/facing layout, with explicit depth uncertainty and preserved legacy geometry',()=>{
    const data=parse(fixtures.C);const svg=renderSVG(data,'top-down');assert.ok(svg.includes('Overhead positions and facing only'));assert.ok(!svg.includes('cx="404" cy="286"'));
    assert.ok(layoutScene(data,'top-down').diagnostics.some(s=>s.includes('default footprints')));
    const old=parse(fixtures.G);assert.equal(old.schemaVersion,undefined);assert.deepEqual(old.people[0].joints,fixtures.G.people[0].joints);assert.equal(parse({...fixtures.G,schemaVersion:1}).people[0].name,'Legacy Alex');
    assert.ok(renderSVG(old,'top-down').includes('Legacy coordinates shown unchanged'));assert.deepEqual(old.people[0].joints,fixtures.G.people[0].joints);
});
