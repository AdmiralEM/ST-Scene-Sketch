import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScene,layoutScene,renderSVG,frameScene,poseJoints } from './scene.js';
import { sceneNotice } from './layout.js';
import { groundSegments } from './props.js';
import { regressionCases,regressionScenes } from './regression-cases.js';
const parse=data=>parseScene(JSON.stringify(data));
const clone=data=>JSON.parse(JSON.stringify(data));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

test('fixed regression cases keep source, intent, visible expectations and limitations distinct',()=>{
    for(const record of regressionCases){
        assert.ok(record.source && record.expected.length && record.limitations.length);
        const original=JSON.stringify(record.scene),scene=parse(record.scene);
        for(const view of ['side','top-down']){
            const layout=layoutScene(scene,view),frame=frameScene(layout),svg=renderSVG(scene,view);
            for(const r of frame.shapes)assert.ok(r.x>=frame.x && r.y>=frame.y && r.x+r.w<=frame.x+frame.width && r.y+r.h<=frame.y+frame.height);
            assert.equal(svg,renderSVG(parse(scene),view),'JSON export/reload retains resolved display');
            const reordered=clone(scene);reordered.people.reverse();reordered.props.reverse();assert.equal(svg,renderSVG(reordered,view),'new interactions do not depend on input order');
        }
        assert.equal(JSON.stringify(record.scene),original,'renderer cannot rewrite scene meaning');
    }
});

test('ground water joins bank level and cuts ground, while explicit basin elevation is retained',()=>{
    const layout=layoutScene(parse(regressionScenes.case_spring)),water=layout.props.find(p=>p.type==='pool');
    near(water.geometry.water.surfaceY,layout.ground);assert.ok(water.geometry.bounds.y>=layout.ground);
    const segments=groundSegments(layout.props,0,800),[a,b]=water.geometry.water.interval;
    assert.ok(segments.every(([x,y])=>y<=a || x>=b),'no continuous solid ground crosses water');
    assert.ok(renderSVG(parse(regressionScenes.case_spring)).includes('data-ground="true"'));
    const elevated=layoutScene(parse(regressionScenes.case_elevated)),basinWater=elevated.props.find(p=>p.type==='pool');
    near(basinWater.geometry.water.surfaceY,310);assert.equal(basinWater.geometry.water.grounded,false);
    const svg=renderSVG(parse(regressionScenes.case_elevated));assert.ok(svg.indexOf('data-prop="basin"')<svg.indexOf('data-prop="water"'),'elevated water remains visible over its basin');
    assert.deepEqual(groundSegments(elevated.props,0,800),[[0,800]]);
    const legacyWater=clone(regressionScenes.case_spring);delete legacyWater.props.find(p=>p.type==='natural spring').waterLevel;
    near(layoutScene(parse(legacyWater)).props.find(p=>p.type==='pool').geometry.water.surfaceY,420);
});

test('back supports must contact mid/upper torso, not only the hip; small rocks fall back',()=>{
    for(const key of ['case_spring','case_springMirror']){
        const p=layoutScene(parse(regressionScenes[key])).people.find(p=>p.id==='alex');
        assert.ok(p.backUsed);near(p.joints[2][1],416);
        const fraction=(p.backContact[1]-p.joints[2][1])/(p.joints[1][1]-p.joints[2][1]);assert.ok(fraction>=.35 && fraction<=.95);
    }
    const tiny=clone(regressionScenes.case_spring),rock=tiny.props.find(p=>p.id==='rock');rock.y=408;rock.h=12;rock.w=35;
    const layout=layoutScene(parse(tiny)),p=layout.people.find(p=>p.id==='alex');assert.equal(p.backUsed,false);near(p.joints[2][1],416);
    assert.ok(layout.diagnostics.some(s=>s.includes('mid/upper-back')));
});

test('standing and seated resting hands/elbows stay separated from trunk and retain lengths',()=>{
    for(const pose of ['standing','sitting','kneeling'])for(const lean of ['upright','backward','forward'])for(const dir of [-1,1]){
        const j=poseJoints(pose,{x:400,dir,lean,arms:'resting',...(pose==='sitting'?{groundSeated:true,hipY:416}:{})});
        for(const [a,b,length] of [[1,3,34],[3,4,32],[1,5,34],[5,6,32]])near(distance(j[a],j[b]),length);
        assert.ok(distance(j[4],j[6])>24);assert.ok(distance(j[4],j[2])>18);assert.ok(distance(j[6],j[2])>18);
        assert.ok(distance(j[3],j[5])>20);
        const mirror=poseJoints(pose,{x:400,dir:-dir,lean,arms:'resting',...(pose==='sitting'?{groundSeated:true,hipY:416}:{})});
        j.forEach(([x,y],i)=>{near(x+mirror[i][0],800);near(y,mirror[i][1]);});
    }
});

test('cup attachment and asymmetric pointing mirror without changing explicit targets',()=>{
    for(const key of ['case_cupDoor','case_cupMirror']){
        const layout=layoutScene(parse(regressionScenes[key])),holder=layout.people.find(p=>p.id==='alex'),pointer=layout.people.find(p=>p.id==='sam'),cup=layout.props.find(p=>p.id==='cup'),door=layout.props.find(p=>p.id==='door');
        assert.deepEqual(cup.attachment,holder.joints[4]);near(cup.geometry.bounds.y+8,holder.joints[4][1]);
        assert.ok(holder.joints[4][1]<holder.joints[6][1]-10,'holding arm differs from resting arm');
        near(pointer.reachTarget[0],door.geometry.bounds.x+door.geometry.bounds.w/2);
        assert.ok((pointer.joints[4][0]-pointer.joints[1][0])*pointer.dir>40);
        for(const p of [holder,pointer]){near(distance(p.joints[1],p.joints[3]),34);near(distance(p.joints[3],p.joints[4]),32);}
    }
    const missing=clone(regressionScenes.case_cupDoor);missing.props[0].heldBy.person='absent';assert.ok(layoutScene(parse(missing)).diagnostics.some(s=>s.includes('held attachment')));
    assert.ok(!layoutScene(parse(missing)).props.some(p=>p.id==='cup'),'unlocated held object is not invented at the canvas origin');
    const far=clone(regressionScenes.case_cupDoor);far.props[0].heldBy.hand='far';const farLayout=layoutScene(parse(far));assert.deepEqual(farLayout.props.find(p=>p.id==='cup').attachment,farLayout.people[0].joints[6]);assert.ok(farLayout.people[0].joints[6][1]<farLayout.people[0].joints[4][1]);
    const pointedCup=clone(regressionScenes.case_cupDoor);pointedCup.people[1].target='cup';const cupTarget=layoutScene(parse(pointedCup));assert.deepEqual(cupTarget.people.find(p=>p.id==='sam').reachTarget,cupTarget.props.find(p=>p.id==='cup').attachment);
});

test('embrace meaning is explicit and not silently claimed as a solved reach/contact pose',()=>{
    for(const key of ['case_embrace','case_embraceMirror']){
        const scene=parse(regressionScenes[key]),layout=layoutScene(scene);assert.ok(scene.people.every(p=>p.contact.type==='embrace'));
        assert.ok(layout.assumptions.some(s=>s.includes('cannot reliably draw the wraparound embrace')));
        assert.ok(!sceneNotice(layout).includes('intent'),'explicit contact is not described as mere intent');
        assert.ok(distance(layout.people[0].joints[0],layout.people[1].joints[0])>24);
    }
    const missing=clone(regressionScenes.case_embrace);missing.people[0].contact.target='absent';assert.ok(layoutScene(parse(missing)).diagnostics.some(s=>s.includes('explicit contact target')));
});

test('notices depend on actual interactions; side projection limits for fire are explicit',()=>{
    assert.ok(!sceneNotice(layoutScene(parse(regressionScenes.case_spring))).includes('Reaching'));
    const reaching=clone(regressionScenes.case_spring);reaching.people[1].arms='reaching';reaching.people[1].target='alex';
    assert.ok(sceneNotice(layoutScene(parse(reaching))).includes('Reaching indicates intent'));
    assert.ok(!sceneNotice(layoutScene(parse(regressionScenes.case_cupDoor))).includes('Reaching'));
    const side=layoutScene(parse(regressionScenes.case_campfire)),overhead=layoutScene(parse(regressionScenes.case_campfire),'top-down');
    assert.ok(side.assumptions.some(s=>s.includes('different distance from the campfire')));
    assert.ok(!overhead.assumptions.some(s=>s.includes('use overhead view')));
    near(side.props[0].geometry.bounds.y+side.props[0].geometry.bounds.h,420);
    assert.ok(new Set(overhead.people.map(p=>p.depth)).size>1);
});

test('new bounded fields reject unsafe values and retain earlier scene format compatibility',()=>{
    const bad=clone(regressionScenes.case_elevated);bad.props[1].surfaceY='330';assert.throws(()=>parse(bad),/finite/);
    bad.props[1].surfaceY=310;bad.props[1].path='<script>';assert.ok(!renderSVG(parse(bad)).includes('<script>'));
    const held=clone(regressionScenes.case_cupDoor);held.props[0].heldBy.hand='arbitrary';assert.equal(parse(held).props[0].heldBy.hand,'near');
    const contact=clone(regressionScenes.case_embrace);contact.people[0].contact.type='<script>';assert.equal(parse(contact).people[0].contact,undefined);
});
