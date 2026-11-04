import { GROUND, EDGES, poseJoints } from './poses.js';
import { propGeometry, backPlacement, attachProps } from './props.js';
import { layoutArticulated } from './articulated.js';
export { GROUND, EDGES, poseJoints } from './poses.js';
export { frameScene } from './labels.js';
const sorted=values=>[...values].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
const midpoint=(a,b,t=.5)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

export function layoutScene(scene,view='side') {
    if(scene.schemaVersion===3)return layoutArticulated(scene,view);
    if(scene.schemaVersion!==2){
        const props=scene.props.map((p,i)=>({...p,id:`legacy-prop-${i}`,type:'box'}));
        return {people:scene.people.map((p,i)=>({...p,id:`legacy-${i}`,dir:p.facing==='left'?-1:1})),props:props.map(p=>({...p,geometry:propGeometry(p)})),
            assumptions:scene.notes?[scene.notes]:[],diagnostics:[],ground:480,overhead:false,legacy:true};
    }
    const assumptions=[...scene.assumptions],diagnostics=[...(scene.warnings ?? [])];
    const note=(technical,visible)=>{diagnostics.push(technical);if(visible)assumptions.push(visible);};
    const people=sorted(scene.people),props=sorted(scene.props),persons=new Map(people.map(p=>[p.id,p])),objects=new Map(props.map(p=>[p.id,p]));
    const geometries=new Map(props.map(p=>[p.id,propGeometry(p)]));
    for(const p of people){
        if(diagnostics.some(s=>s.startsWith(`Pose for ${p.id}:`)))assumptions.push(`${p.name} is shown standing because their posture was not specified clearly.`);
        if(diagnostics.some(s=>s.startsWith(`Reach region for ${p.id}:`)))assumptions.push(`${p.name}'s reach is shown in a general direction; no specific touch is established.`);
    }
    const anchors=new Map(),visiting=[],cycles=new Set(),visited=new Set();
    function findCycles(p){
        const index=visiting.indexOf(p.id);
        if(index>=0){for(const id of visiting.slice(index))cycles.add(id);return;}
        if(visited.has(p.id))return;
        visiting.push(p.id);const next=persons.get(p.beside?.target);if(next)findCycles(next);
        visiting.pop();visited.add(p.id);
    }
    people.forEach(findCycles);
    const fallbackX=p=>p.x ?? (people.length===1?400:100+people.findIndex(other=>other.id===p.id)*600/(people.length-1));
    const resolve=p=>{
        if(anchors.has(p.id))return anchors.get(p.id);
        let x=fallbackX(p),depth=p.depth ?? 250,hipY,lean=p.lean,onUsed=false,backUsed=false,backDir,backContact;
        const onRef=p.support?.type==='on'?p.support:null;
        const backRef=p.backSupport ?? (p.support?.type==='against'?p.support:null);
        if(p.backSupport && p.support?.type==='against' && p.backSupport.target!==p.support.target)note(`${p.name}: conflicting back-support targets; explicit backSupport takes priority.`);
        let groundSeated=p.pose==='sitting' && (p.seat==='ground' || (!onRef && !!backRef));
        if(groundSeated)hipY=GROUND-4;
        const onGeometry=onRef?geometries.get(onRef.target):null;
        if(onRef){
            const surface=onGeometry?.top,minimum=p.pose==='sitting'?32:210;
            if(p.seat==='ground')note(`${p.name}: ground seating overrides on-support constraint.`,`${p.name} stays seated on the ground rather than on the object.`);
            else if(!surface || !['sitting','lying','reclining'].includes(p.pose) || surface.x2-surface.x1<minimum)
                note(`${p.name}: invalid or missing solid support, insufficient usable surface, or incompatible pose.`,`${p.name} is shown without the requested seat because it could not be placed safely in this sketch.`);
            else {
                onUsed=true;groundSeated=false;x=(surface.x1+surface.x2)/2;hipY=surface.y-(p.pose==='sitting'?0:4);
                depth=objects.get(onRef.target).depth ?? depth;
                if(p.x!=null)note(`${p.name}: on-support anchor overrides supplied x coordinate.`);
            }
        }
        if(!onUsed && p.beside){
            const other=persons.get(p.beside.target),prop=objects.get(p.beside.target),sign=p.beside.side==='left'?-1:1;
            if(cycles.has(p.id))note(`${p.name}: circular beside relationships ignored; using fallback placement.`,`${p.name} is placed approximately because the requested positions contradict one another.`);
            else if(other){const a=resolve(other);x=a.x+sign*140;depth=p.depth ?? a.depth;}
            else if(prop){const b=geometries.get(prop.id).bounds;x=(sign===1?b.x+b.w:b.x)+sign*100;depth=p.depth ?? prop.depth ?? 250;}
            else note(`${p.name}: missing beside target; using fallback placement.`,`${p.name} is placed approximately because the nearby person or object is missing.`);
        } else if(onUsed && p.beside)note(`${p.name}: conflicting on-support and beside constraints; on-support has priority.`);
        else if(p.x==null && !onUsed && !backRef)note(`${p.name}: no placement supplied; using ID-sorted fallback position.`);
        if(backRef){
            const geometry=geometries.get(backRef.target),prop=objects.get(backRef.target);
            let dir=backRef.side==='left'?-1:backRef.side==='right'?1:p.facing==='left'?-1:1;
            if(!backRef.side && p.facing==='toward' && persons.get(p.target)?.x!=null && persons.get(p.target).x<(geometry?.bounds.x ?? x))dir=-1;
            const body=poseJoints(p.pose,{x:0,hipY,groundSeated,dir,lean:'backward'});
            const placement=geometry && ['sitting','standing','kneeling'].includes(p.pose)?backPlacement(geometry,dir,body):null;
            let obstructed=false;
            if(placement && geometry.top && !onUsed){
                const a=body[1],b=body[2],y=geometry.top.y;
                if(y>Math.min(a[1],b[1])+1 && y<Math.max(a[1],b[1])-1){
                    const crossX=placement.x+a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]);
                    obstructed=crossX>geometry.top.x1 && crossX<geometry.top.x2;
                }
            }
            const fitsSeat=!onUsed || (placement && placement.x>=onGeometry.top.x1+3 && placement.x<=onGeometry.top.x2-3);
            if(!placement || !fitsSeat || obstructed)
                note(`${p.name}: back-support target is missing, incompatible, outside the mid/upper-back anchor zone, or conflicts with the seat.`,`${p.name} ${onUsed?'remains seated':'is placed approximately'}; the requested back support could not be arranged.`);
            else {
                x=placement.x;backUsed=true;backDir=dir;backContact=placement.point;lean='backward';depth=prop.depth ?? depth;
                if(p.lean==='forward')note(`${p.name}: forward lean conflicts with back support; backward lean used.`,`${p.name} leans back to rest against ${prop.name}.`);
                if(p.x!=null)note(`${p.name}: back-support contact overrides supplied x coordinate.`);
                if(p.beside)note(`${p.name}: back support determines final position instead of beside constraint.`);
            }
        }
        if(!onUsed && !backUsed && p.x==null && !p.beside && (onRef || backRef)){
            // A missing support gives no reliable position. Prefer open ground to
            // placing the default figure inside water/furniture. This is only a
            // conservative fallback, never an inferred shoreline or collision engine.
            const blocked=props.filter(prop=>prop.type==='pool' || (geometries.get(prop.id).bounds.y<=GROUND && geometries.get(prop.id).bounds.y+geometries.get(prop.id).bounds.h>=GROUND-160)).map(prop=>geometries.get(prop.id).bounds);
            const candidates=[x,100,400,700,...blocked.flatMap(b=>[b.x-104,b.x+b.w+104])].filter(value=>value>=40 && value<=760 && !blocked.some(b=>value>b.x-100 && value<b.x+b.w+100));
            candidates.sort((a,b)=>Math.abs(a-x)-Math.abs(b-x)||a-b);
            if(candidates.length){x=candidates[0];note(`${p.name}: failed support fallback placed on open ground outside nominal prop footprints.`);}
        }
        if(p.seat==='ground' && p.pose!=='sitting')note(`${p.name}: ground-seat modifier ignored for ${p.pose}.`);
        const anchor={x,depth,hipY,lean,groundSeated,onUsed,backUsed,supportUsed:onUsed||backUsed,backDir,backContact};anchors.set(p.id,anchor);return anchor;
    };
    people.forEach(resolve);
    // Resolve all resting body regions before aiming any reaching arms. Mutual
    // reaches cannot introduce a geometry dependency cycle or order dependence.
    const base=people.map(p=>{
        const a=anchors.get(p.id),target=anchors.get(p.target);
        let dir=p.facing==='left'?-1:1;
        if(p.facing==='toward' && target && p.target!==p.id)dir=target.x<a.x?-1:1;
        if(a.backUsed && dir!==a.backDir){
            note(`${p.name}: facing conflicts with chosen back-support side; facing away from the support.`,`${p.name} faces away from the supporting object so their back can rest against it.`);dir=a.backDir;
        }
        if(p.pose==='lying' && p.lean!=='upright')note(`${p.name}: lean ignored for horizontal lying pose.`);
        if(a.onUsed && p.pose==='sitting' && a.hipY<GROUND-92)note(`${p.name}: seat is above leg reach.`,`${p.name} sits high enough that their feet hang above the ground.`);
        const holdingHand=props.find(prop=>prop.type==='cup' && prop.heldBy?.person===p.id)?.heldBy.hand ?? 'near';
        return {...p,...a,dir,holdingHand,joints:poseJoints(p.pose,{...a,dir,holdingHand,arms:p.arms==='reaching'?'resting':p.arms})};
    });
    const byId=new Map(base.map(p=>[p.id,p]));
    const positioned=base.map(p=>{
        const target=p.target!==p.id?byId.get(p.target):null;
        const pointingProp=p.arms==='pointing'?objects.get(p.target):null;
        if((p.target && !target && !pointingProp) || ((p.facing==='toward' || p.arms==='reaching' || p.arms==='pointing') && !target && !pointingProp))
            note(`${p.name}: missing or invalid interaction target; default facing/reach used.`,p.arms==='reaching'?`${p.name} reaches in a general direction because the intended person is not available in the sketch.`:undefined);
        let reachTarget;
        if(target){
            const nearest=points=>points.reduce((a,b)=>distance(p.joints[1],a)<=distance(p.joints[1],b)?a:b);
            const j=target.joints;
            if(p.targetRegion==='head')reachTarget=j[0];
            else if(p.targetRegion==='shoulder')reachTarget=j[1];
            else if(p.targetRegion==='hand')reachTarget=nearest([j[4],j[6]]);
            else if(p.targetRegion==='forearm')reachTarget=nearest([midpoint(j[3],j[4]),midpoint(j[5],j[6])]);
            else reachTarget=midpoint(j[1],j[2],.55);
        }
        if(pointingProp){
            const owner=byId.get(pointingProp.heldBy?.person);
            if(pointingProp.type==='cup' && pointingProp.heldBy){
                if(owner)reachTarget=owner.joints[pointingProp.heldBy.hand==='far'?6:4];
                else note(`${p.name}: pointing target's holder is missing; using default gesture.`);
            } else {const b=geometries.get(pointingProp.id).bounds;reachTarget=[b.x+b.w/2,b.y+b.h/2];}
        }
        if(p.contact){
            const other=byId.get(p.contact.target);
            if(other && other.id!==p.id){
                const names=[p,other].sort((a,b)=>a.id<b.id?-1:1).map(person=>person.name);
                note(`${names.join(' / ')}: explicit embrace retained; wraparound contact is not solved.`,`${names.join(' and ')} are described as embracing. The sketch shows close placement, but cannot reliably draw the wraparound embrace.`);
            } else note(`${p.name}: missing or invalid explicit contact target.`,`${p.name}'s described embrace cannot be placed because the other participant is missing.`);
        }
        return {...p,reachTarget,action:`${p.groundSeated?'sitting on ground':p.pose}; arms ${p.arms}`,
            joints:['reaching','pointing'].includes(p.arms)?poseJoints(p.pose,{...p,arms:p.arms,target:reachTarget}):p.joints};
    });
    const overhead=view==='top-down';
    const resolvedProps=attachProps(props,positioned,overhead,note);
    if(!overhead)for(const fire of props.filter(p=>p.type==='campfire')){
        const b=geometries.get(fire.id).bounds;
        for(const p of positioned)if(p.x>=b.x && p.x<=b.x+b.w && p.depth!=null && fire.depth!=null && Math.abs(p.depth-fire.depth)>30)
            note(`${p.name}: side projection overlaps the campfire despite different depth.`,`${p.name} is at a different distance from the campfire; use overhead view to distinguish their positions.`);
    }
    if(overhead && (people.some(p=>p.depth==null)||props.some(p=>p.depth==null || p.footprint==null)))
        note('Overhead depth/footprint values missing; schematic row and default footprints used.','Distances and shoreline positions in the overhead view are approximate.');
    return {people:positioned,props:resolvedProps.map(p=>({...p,geometry:propGeometry(p,overhead)})),assumptions:[...new Set(assumptions)],diagnostics:[...new Set(diagnostics)],ground:GROUND,overhead,legacy:false};
}

export function sceneNotice(layout){
    if(layout.legacy)return 'Older sketch shown unchanged; no overhead information was stored.';
    if(layout.overhead)return layout.articulated?'Overhead placement markers only — custom side-view articulation is not an overhead projection.':'Overhead positions and facing only. Distances and shoreline are approximate.';
    const reaching=layout.people.some(p=>p.arms==='reaching' && !p.contact);
    return `Pose view — approximate blocking.${reaching?' Reaching indicates intent, not confirmed contact.':''}`;
}
