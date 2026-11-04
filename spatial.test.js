import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScene,layoutScene,frameScene,renderSVG } from './scene.js';
import { propGeometry } from './props.js';
import { spatialFixtures,mirrorScene } from './spatial-fixtures.js';
const clone=v=>JSON.parse(JSON.stringify(v));
const parse=v=>parseScene(JSON.stringify(v));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const edgeDistance=(r,p)=>Math.hypot(p[0]-Math.max(r.x,Math.min(r.x+r.w,p[0])),p[1]-Math.max(r.y,Math.min(r.y+r.h,p[1])));

test('ground sitting and back support meet the actual stone outline without becoming an on-seat',()=>{
    for(const data of [spatialFixtures.spring,spatialFixtures.mirror]){
        const layout=layoutScene(parse(data)),person=layout.people.find(p=>p.id==='alex'),stone=layout.props.find(p=>p.id==='rock');
        near(person.joints[2][1],416);near(person.joints[8][1],416);
        assert.equal(person.onUsed,false);assert.equal(person.backUsed,true);assert.equal(person.groundSeated,true);
        assert.ok(person.joints[2][1]>stone.geometry.top.y+30);
        assert.ok(person.dir*(person.joints[2][0]-person.joints[1][0])>0,'torso leans backward relative to facing');
        const [hip,neck]=[person.joints[2],person.joints[1]],[edgeX,y]=person.backContact;
        const torsoX=hip[0]+(neck[0]-hip[0])*(y-hip[1])/(neck[1]-hip[1]);near((torsoX-edgeX)*person.dir,3);
        const side=stone.geometry.backs[person.dir===1?'right':'left'];
        assert.ok(side.some((p,i)=>i && y>=Math.min(side[i-1][1],p[1]) && y<=Math.max(side[i-1][1],p[1])),'contact is on a visible support segment');
    }
});

test('mirroring the synthetic bank scene mirrors joints and preserves support relationships',()=>{
    const a=layoutScene(parse(spatialFixtures.spring)),b=layoutScene(parse(mirrorScene(spatialFixtures.spring)));
    for(const person of a.people){const other=b.people.find(p=>p.id===person.id);person.joints.forEach(([x,y],i)=>{near(x+other.joints[i][0],800);near(y,other.joints[i][1]);});assert.equal(person.onUsed,other.onUsed);assert.equal(person.backUsed,other.backUsed);}
});

test('chair seat plus back support stays on the seat; bed attaches to its rendered surface',()=>{
    for(const data of [spatialFixtures.chairBack,mirrorScene(spatialFixtures.chairBack)]){
        const layout=layoutScene(parse(data)),p=layout.people[0],chair=layout.props[0],seat=chair.geometry.top;
        assert.ok(p.onUsed && p.backUsed);near(p.joints[2][1],seat.y);assert.ok(p.x>seat.x1 && p.x<seat.x2);
    }
    const bed=layoutScene(parse(spatialFixtures.bed)),p=bed.people.find(p=>p.id==='alex');near(p.joints[0][1]+12,bed.props[0].geometry.top.y);
});

test('water is a shallow horizontal surface in side view and broader overhead, without moving people',()=>{
    const data=parse(spatialFixtures.spring),side=layoutScene(data),overhead=layoutScene(data,'top-down');
    const a=side.props.find(p=>p.type==='pool'),b=overhead.props.find(p=>p.type==='pool');
    assert.equal(a.name,'Natural spring');assert.equal(data.warnings.length,0,'ordinary rock/spring synonyms do not warn');
    assert.ok(a.geometry.bounds.h<=16);assert.ok(a.geometry.bounds.w/a.geometry.bounds.h>=10);
    assert.ok(b.geometry.bounds.h>a.geometry.bounds.h*3);
    for(const p of side.people){const q=overhead.people.find(q=>q.id===p.id);near(p.x,q.x);assert.deepEqual(p.joints,q.joints);}
    assert.ok(!overhead.diagnostics.some(s=>s.includes('unsupported')));
});

test('all symbol bounds enclose local primitives; supports come from visible edges',()=>{
    for(const type of ['box','chair','table','bed','stone','pool','door'])for(const overhead of [false,true]){
        const geometry=propGeometry({type,x:100,y:320,w:180,h:100},overhead),b=geometry.bounds;
        const points=geometry.shapes.flatMap(s=>s.points ?? (s.tag==='line'?[[s.x1,s.y1],[s.x2,s.y2]]:s.tag==='ellipse'?[[s.cx-s.rx,s.cy-s.ry],[s.cx+s.rx,s.cy+s.ry]]:[[s.x,s.y],[s.x+s.width,s.y+s.height]]));
        for(const [x,y] of points)assert.ok(x>=b.x && x<=b.x+b.w && y>=b.y && y<=b.y+b.h);
        if(type==='pool' || type==='door')assert.equal(geometry.top,null);
        if(!overhead && ['chair','table','bed','box'].includes(type))assert.ok(geometry.shapes.some(s=>s.tag==='rect' && s.y===geometry.top.y),'support matches drawn top');
        if(type==='stone' && !overhead){near(geometry.outline[0][1],geometry.top.y);near(geometry.outline[1][1],geometry.top.y);}
    }
});

test('neutral reaches aim below the head, bend when close, and never stretch or assert contact',()=>{
    for(const key of ['near','far','head']){
        const layout=layoutScene(parse(spatialFixtures[key])),p=layout.people.find(p=>p.id==='alex'),target=layout.people.find(p=>p.id==='sam'),j=p.joints;
        if(key==='head')assert.deepEqual(p.reachTarget,target.joints[0]);
        else assert.ok(p.reachTarget[1]>target.joints[1][1]+20,'neutral torso, not neck/head');
        near(distance(j[1],j[3]),34);near(distance(j[3],j[4]),32);
        assert.ok(distance(j[1],j[4])<=62.0001);assert.ok(distance(j[4],p.reachTarget)>4);
        assert.equal(p.contact,undefined);
    }
    const nearPose=layoutScene(parse(spatialFixtures.near)).people[0],farPose=layoutScene(parse(spatialFixtures.far)).people[0];
    assert.ok(distance(nearPose.joints[1],nearPose.joints[4])<distance(farPose.joints[1],farPose.joints[4]));
    for(const region of ['hand','forearm','shoulder']){const data=clone(spatialFixtures.near);data.people[0].targetRegion=region;assert.ok(layoutScene(parse(data)).people[0].reachTarget.every(Number.isFinite));}
});

test('labels choose nearby candidates and leaders rather than climbing above the scene',()=>{
    for(const data of Object.values(spatialFixtures))for(const view of ['side','top-down']){
        const parsed=parse(data),layout=layoutScene(parsed,view),frame=frameScene(layout);
        for(const label of frame.labels){
            if(label.kind==='person')assert.ok(edgeDistance(label.bounds,label.anchor)<55,'participant label stays near its final head');
            else {const prop=layout.props.find(p=>p.id===label.id),b=prop.geometry.bounds;assert.ok(Math.max(0,label.bounds.x-(b.x+b.w),b.x-(label.bounds.x+label.w))<=10);}
            if(label.leader)assert.equal(label.candidate>0,true);
            assert.ok(label.bounds.x>=frame.x && label.bounds.y>=frame.y && label.bounds.x+label.w<=frame.x+frame.width && label.bounds.y+label.h<=frame.y+frame.height);
        }
        for(const shape of frame.shapes)assert.ok(shape.x>=frame.x && shape.y>=frame.y && shape.x+shape.w<=frame.x+frame.width && shape.y+shape.h<=frame.y+frame.height);
        assert.equal(renderSVG(parsed,view),renderSVG(parse(parsed),view));
    }
    const frame=frameScene(layoutScene(parse(spatialFixtures.labels)));assert.ok(frame.labels.some(l=>l.leader),'crowded fixture actually exercises leader placement');
});

test('diagnostics are separate from ordinary scene assumptions and malformed fields stay safe',()=>{
    const layout=layoutScene(parse(spatialFixtures.invalid));assert.ok(layout.diagnostics.some(s=>s.includes('missing')));assert.ok(layout.diagnostics.some(s=>s.includes('unknown value')));
    const fallback=layout.people.find(p=>p.id==='alex'),water=layout.props.find(p=>p.type==='pool');
    assert.ok(fallback.x<water.x || fallback.x>water.x+water.w,'missing-support fallback does not put an unpositioned person into water');
    assert.ok(!layout.assumptions.some(s=>/constraint|anchor|coordinate|unknown value/.test(s)));
    const data=clone(spatialFixtures.spring);data.people[0].targetRegion='javascript:alert(1)';data.props[0].path='<script>';data.props[0].name='<img src=x onerror=alert(1)>';
    const parsed=parse(data),svg=renderSVG(parsed);assert.equal(parsed.props[0].path,undefined);assert.ok(!svg.includes('<img'));assert.ok(svg.includes('&lt;img'));
    assert.equal(parsed.people[0].targetRegion,'neutral');assert.equal(renderSVG(parsed),renderSVG(parse(parsed)));
    data.people[0].backSupport={target:'absent'};assert.doesNotThrow(()=>layoutScene(parse(data)));
});
