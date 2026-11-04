// Schema-3 order: build local preset -> explicit overrides -> requested mirror ->
// placement/whole-figure translations -> aim only unlocked preset arms -> attach props.
import { JOINT_NAMES } from './skeleton.js';
import { GROUND, EDGES, poseJoints, bentArm } from './poses.js';
import { propGeometry, backPlacement, attachProps } from './props.js';
const sorted=list=>[...list].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const mid=(a,b,t=.5)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const shift=(joints,x,y)=>joints.map(([a,b])=>[a+x,b+y]);
export function localSkeleton(person,holdingHand='near'){
    const g=person.geometry;
    const local=g.mode==='custom'?JOINT_NAMES.map(name=>[...g.joints[name]]):poseJoints(g.preset,{x:0,hipY:0,lean:person.lean,arms:person.arms,groundSeated:person.seat==='ground',holdingHand});
    if(g.mode==='preset')for(const [name,pair] of Object.entries(g.overrides ?? {}))local[JOINT_NAMES.indexOf(name)]=[...pair];
    const sign=g.transform?.mirrorX?-1:1;
    return local.map(([x,y])=>[x*sign,y]);
}
export function layoutArticulated(scene,view='side'){
    const diagnostics=[...scene.warnings],assumptions=[...scene.assumptions];
    const note=(message,visible)=>{diagnostics.push(message);if(visible)assumptions.push(visible);};
    const people=sorted(scene.people),props=sorted(scene.props),objects=new Map(props.map(p=>[p.id,p]));
    const geometries=new Map(props.map(p=>[p.id,propGeometry(p)]));
    const initial=new Map(people.map(p=>{
        const held=props.find(prop=>prop.type==='cup' && prop.heldBy?.person===p.id);
        const local=localSkeleton(p,held?.heldBy.hand ?? 'near');
        const angle=p.geometry.headFacing*(Math.PI/180),mirror=p.geometry.transform?.mirrorX;
        const headAngle=Math.atan2(Math.sin(angle),(mirror?-1:1)*Math.cos(angle))*180/Math.PI;
        return [p.id,{...p,local,joints:shift(local,p.placement.x,p.placement.y),x:p.placement.x,y:p.placement.y,depth:p.placement.depth ?? 250,dir:mirror?-1:1,headAngle,
            action:p.description || (p.geometry.mode==='custom'?'custom articulated pose':`${p.geometry.preset} preset with explicit geometry`)}];
    }));
    const resolved=new Map(),visiting=new Set(),cyclic=new Set(),stack=[],checked=new Set();
    function findCycles(id){
        const at=stack.indexOf(id);if(at>=0){for(const key of stack.slice(at))cyclic.add(key);return;}
        if(checked.has(id))return;
        stack.push(id);const next=initial.get(id)?.beside?.target;if(initial.has(next))findCycles(next);
        stack.pop();checked.add(id);
    }
    people.forEach(p=>findCycles(p.id));
    function resolve(id){
        if(resolved.has(id))return resolved.get(id);
        const input=initial.get(id);if(!input)return null;
        if(visiting.has(id)){note(`${input.name}: circular placement relations; explicit placement retained.`);return input;}
        visiting.add(id);
        let body={...input,joints:input.joints.map(pair=>[...pair])};
        const move=(x,y)=>{body={...body,x:body.x+x,y:body.y+y,joints:shift(body.joints,x,y)};};
        const auto=body.placement.resolveRelations;
        const relation=(name,dx,dy)=>{
            if(auto)move(dx,dy);
            else if(Math.hypot(dx,dy)>4)note(`${body.name}: unresolved ${name}; placement.resolveRelations is false. Explicit geometry and placement retained.`,`${body.name}'s requested ${name} does not match the supplied pose and position.`);
        };
        const on=body.support?.type==='on'?body.support:null;
        const back=body.backSupport ?? (body.support?.type==='against'?body.support:null);
        if(on && body.seat==='ground')note(`${body.name}: ground seating conflicts with on-support; geometry retained and on-support checked first.`);
        if(on){
            const surface=geometries.get(on.target)?.top;
            if(!surface)note(`${body.name}: unresolved on-support target; explicit geometry retained.`,`${body.name}'s requested support could not be placed.`);
            else relation('on-support', (surface.x1+surface.x2)/2-body.joints[2][0],surface.y-body.joints[2][1]);
        } else if(body.seat==='ground')relation('ground seating',0,GROUND-4-body.joints[2][1]);
        if(back){
            const geometry=geometries.get(back.target),dir=back.side==='left'?-1:back.side==='right'?1:body.dir;
            const leaningBack=(body.joints[2][0]-body.joints[1][0])*dir>0;
            const result=geometry && leaningBack?backPlacement(geometry,dir,body.joints):null;
            const top=on && geometries.get(on.target)?.top;
            const newHip=result?body.joints[2][0]+result.x:0;
            if(!result || (top && (newHip<top.x1 || newHip>top.x2)))note(`${body.name}: unresolved back-support constraint; no torso reconstruction or mirroring performed.`,`${body.name}'s back support conflicts with the supplied pose; the pose is preserved.`);
            else relation('back support',result.x,0);
        }
        if(body.beside){
            if(on || back)note(`${body.name}: beside relation not applied in addition to support; explicit geometry retained.`);
            else if(cyclic.has(id))note(`${body.name}: circular beside constraints ignored; explicit placement retained.`);
            else {
                const other=initial.has(body.beside.target)?resolve(body.beside.target):null;
                const prop=geometries.get(body.beside.target),sign=body.beside.side==='left'?-1:1;
                if(other)relation('beside placement',other.x+sign*140-body.x,0);
                else if(prop)relation('beside placement',(sign===1?prop.bounds.x+prop.bounds.w:prop.bounds.x)+sign*100-body.x,0);
                else note(`${body.name}: missing beside target; explicit placement retained.`);
            }
        }
        visiting.delete(id);resolved.set(id,body);return body;
    }
    people.forEach(p=>resolve(p.id));
    const base=people.map(p=>resolved.get(p.id)),byId=new Map(base.map(p=>[p.id,p]));
    const final=base.map(p=>{
        let joints=p.joints.map(pair=>[...pair]);
        const other=p.target!==p.id?byId.get(p.target):null;
        let target;
        if(other){
            const j=other.joints,nearest=list=>list.reduce((a,b)=>distance(joints[1],a)<distance(joints[1],b)?a:b);
            target=p.targetRegion==='head'?j[0]:p.targetRegion==='shoulder'?j[1]:p.targetRegion==='hand'?nearest([j[4],j[6]]):p.targetRegion==='forearm'?nearest([mid(j[3],j[4]),mid(j[5],j[6])]):mid(j[1],j[2],.55);
        } else if(p.arms==='pointing' && objects.has(p.target)){
            const prop=objects.get(p.target),owner=byId.get(prop.heldBy?.person),b=geometries.get(prop.id).bounds;
            target=owner?owner.joints[prop.heldBy.hand==='far'?6:4]:prop.heldBy?undefined:[b.x+b.w/2,b.y+b.h/2];
        }
        if(p.target && !target)note(`${p.name}: missing or incompatible interaction target; explicit geometry retained.`);
        if(['reaching','pointing'].includes(p.arms)){
            const indices=p.arms==='pointing'?[[3,4]]:[[3,4],[5,6]];
            for(const [arm,[elbow,hand]] of indices.entries()){
                const locked=p.geometry.mode==='custom' || [JOINT_NAMES[elbow],JOINT_NAMES[hand]].some(name=>Object.hasOwn(p.geometry.overrides ?? {},name));
                if(locked)note(`${p.name}: ${JOINT_NAMES[elbow]}/${JOINT_NAMES[hand]} explicit chain retained; ${p.arms} solver not applied.`);
                else if(target){
                    let destination=target;
                    if(arm){const angle=10*p.dir*Math.PI/180,dx=target[0]-joints[1][0],dy=target[1]-joints[1][1];destination=[joints[1][0]+dx*Math.cos(angle)-dy*Math.sin(angle),joints[1][1]+dx*Math.sin(angle)+dy*Math.cos(angle)];}
                    [joints[elbow],joints[hand]]=bentArm(joints[1],destination,-p.dir,62,p.arms==='reaching'?8:0);
                }
            }
        }
        if(p.geometry.mode==='custom' && (p.lean!=null || ['resting','raised','holding'].includes(p.arms)))note(`${p.name}: custom joints take precedence over lean/arm preset modifiers.`);
        if(p.facing==='toward' && other)note(`${p.name}: toward-facing is descriptive in schema 3; headFacing and mirrorX are not changed implicitly.`);
        if(p.contact){const other=byId.get(p.contact.target);note(`${p.name}: ${other?'explicit contact recorded; no contact solver modifies joints':'contact target missing; explicit pose retained'}.`,other?'Contact is described, but the two-dimensional skeleton does not establish wraparound depth or validate a touch.':`${p.name}'s described contact has a missing participant.`);}
        const lengths=EDGES.map(([a,b])=>distance(joints[a],joints[b]));
        if(lengths.some(length=>length<2 || length>180))note(`${p.name}: unusually short/long projected segments; structurally valid explicit geometry rendered without repair.`);
        const overheadDir=p.facing==='left'?-1:p.facing==='toward' && other?(other.x<p.x?-1:1):p.facing==='right'?1:p.dir;
        return {...p,joints,reachTarget:target,overheadDir};
    });
    const overhead=view==='top-down';
    if(overhead && people.some(p=>p.placement.depth==null))note('Overhead depth unspecified for some people; marker row defaults to 250.','Some overhead distances are unspecified; markers are schematic.');
    if(overhead && props.some(p=>p.depth==null || p.footprint==null))note('Overhead prop depth/footprint defaults used; custom side-view coordinates do not determine a footprint.');
    const placedProps=attachProps(props,final,overhead,note).map(p=>({...p,geometry:propGeometry(p,overhead)}));
    return {people:final,props:placedProps,assumptions:[...new Set(assumptions)],diagnostics:[...new Set(diagnostics)],ground:GROUND,overhead,legacy:false,articulated:true};
}
