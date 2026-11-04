// Local symbol library. The same primitives and anchors drive drawing and layout.
import { GROUND } from './poses.js';
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const boundsOf=points=>({x:Math.min(...points.map(p=>p[0])),y:Math.min(...points.map(p=>p[1])),w:Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0])),h:Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1]))});
export function propGeometry(p,overhead=false) {
    const {x,w}=p,shapes=[];
    const depth=p.depth ?? 250;
    const footprint=p.footprint ?? (p.type==='pool'?clamp(w*.5,60,160):60);
    let y=overhead?depth-footprint/2:p.y,h=overhead?footprint:p.h;
    const rect=(rx=x,ry=y,rw=w,rh=h,round=3,fill)=>shapes.push({tag:'rect',x:rx,y:ry,width:rw,height:rh,rx:round,...(fill?{fill}:{})});
    const line=(a,b)=>shapes.push({tag:'line',x1:a[0],y1:a[1],x2:b[0],y2:b[1]});
    const polygon=points=>shapes.push({tag:'polygon',points});
    const ellipse=(fill)=>shapes.push({tag:'ellipse',cx:x+w/2,cy:y+h/2,rx:w/2,ry:h/2,fill});
    let top=null,backs={},outline,water=null;
    if(p.type==='pool') {
        if(!overhead){
            h=clamp(w*.07,6,16);
            const elevated=p.waterLevel==='elevated' || (p.surfaceY!=null && p.surfaceY!==GROUND);
            y=p.surfaceY ?? (elevated?p.y:GROUND);
            water={surfaceY:y,grounded:!elevated,interval:[x-6,x+w+6]};
        }
        ellipse('#193c50');
        line([x+w*.22,y+h*.4],[x+w*.55,y+h*.4]);line([x+w*.48,y+h*.66],[x+w*.78,y+h*.66]);
        if(water?.grounded){line([x-6,GROUND],[x,y+h/2]);line([x+w,y+h/2],[x+w+6,GROUND]);}
    } else if(p.type==='cup') {
        const width=Math.min(w,20),height=Math.min(h,24);
        shapes.push({tag:'polyline',points:[[x,y],[x+width,y],[x+width-2,y+height],[x+2,y+height],[x,y]],fill:'#263347'});
    } else if(p.type==='campfire') {
        const width=Math.min(w,70),height=Math.min(h,55),cx=x+w/2,base=y+h;
        line([cx-width/2,base],[cx+width/2,base-6]);line([cx-width/2,base-6],[cx+width/2,base]);
        shapes.push({tag:'polygon',points:[[cx-width*.3,base-10],[cx,base-height],[cx+width*.3,base-10]],fill:'#71513b'});
    } else if(p.type==='stone') {
        if(!overhead){h=Math.min(p.h,clamp(w*.46,6,95));y=p.y+p.h-h;}
        outline=[[x+w*.24,y],[x+w*.73,y],[x+w*.94,y+h*.38],[x+w,y+h*.78],[x+w*.88,y+h],[x+w*.14,y+h],[x,y+h*.76],[x+w*.04,y+h*.36]];
        if(p.facing==='left')outline=outline.map(([px,py])=>[2*x+w-px,py]);
        shapes.push({tag:'polygon',points:outline,fill:'#3b4553'});
        line([x+w*.3,y+h*.25],[x+w*.65,y+h*.2]);
        if(!overhead){
            top={x1:Math.min(outline[0][0],outline[1][0]),x2:Math.max(outline[0][0],outline[1][0]),y};
            const a=[outline[0],outline[7],outline[6],outline[5]],b=[outline[1],outline[2],outline[3],outline[4]];
            backs=p.facing==='left'?{left:b,right:a}:{left:a,right:b};
        }
    } else if(overhead) {
        rect(x,y,w,h,p.type==='bed'?6:2);
        if(p.type==='chair' || p.type==='bed'){
            const backX=p.facing==='left'?x+w-8:x;
            rect(backX,y,8,h,2);
        } else if(p.type==='door')line([x+w*.25,y+h*.85],[x+w*.75,y+h*.85]);
    } else if(p.type==='chair') {
        const right=p.facing==='left',backX=right?x+w-8:x;
        rect(x,y,w,7,2);rect(backX,y-55,8,62,3);
        line([x+6,y+7],[x+6,y+h]);line([x+w-6,y+7],[x+w-6,y+h]);
        top={x1:x+(right?0:8),x2:x+w-(right?8:0),y};
        backs[right?'left':'right']=[[backX+(right?0:8),y-55],[backX+(right?0:8),y]];
    } else if(p.type==='table') {
        rect(x,y,w,7,2);line([x+8,y+7],[x+8,y+h]);line([x+w-8,y+7],[x+w-8,y+h]);
        top={x1:x+4,x2:x+w-4,y};
    } else if(p.type==='bed') {
        rect(x,y,w,Math.min(16,h),5);
        line([x+8,y+Math.min(16,h)],[x+8,y+h]);line([x+w-8,y+Math.min(16,h)],[x+w-8,y+h]);
        top={x1:x+4,x2:x+w-4,y};
    } else if(p.type==='door') {
        // An open doorway: jambs/lintel plus a short threshold, no solid slab.
        shapes.push({tag:'polyline',points:[[x,y+h],[x,y],[x+w,y],[x+w,y+h]],fill:'none'});
        line([x+w*.2,y+h],[x+w*.8,y+h]);
    } else {
        rect();top={x1:x,x2:x+w,y};
        backs={left:[[x,y],[x,y+h]],right:[[x+w,y],[x+w,y+h]]};
    }
    const corners=[];
    for(const s of shapes){
        if(s.points)corners.push(...s.points);
        else if(s.tag==='line')corners.push([s.x1,s.y1],[s.x2,s.y2]);
        else if(s.tag==='ellipse')corners.push([s.cx-s.rx,s.cy-s.ry],[s.cx+s.rx,s.cy+s.ry]);
        else corners.push([s.x,s.y],[s.x+s.width,s.y+s.height]);
    }
    const bounds=boundsOf(corners);
    return {shapes,bounds,top,backs,depth,labelAnchor:[bounds.x+bounds.w/2,bounds.y],outline,water};
}

export function groundSegments(props,start,end){
    const gaps=props.filter(p=>p.geometry.water?.grounded).map(p=>p.geometry.water.interval).sort((a,b)=>a[0]-b[0]);
    const segments=[];let cursor=start;
    for(const [a,b] of gaps){if(a>cursor)segments.push([cursor,Math.min(a,end)]);cursor=Math.max(cursor,b);}
    if(cursor<end)segments.push([cursor,end]);
    return segments.filter(([a,b])=>b>a);
}

// Tangency between a fixed-length torso and the object's visible back-support side.
// Returns a horizontal translation, never changes hip height or stretches a bone.
export function backPlacement(geometry,dir,joints) {
    const side=geometry.backs[dir===1?'right':'left'];
    if(!side)return null;
    const hip=joints[2],neck=joints[1],lo=Math.min(hip[1],neck[1]),hi=Math.max(hip[1],neck[1]);
    const candidates=[];
    for(let i=1;i<side.length;i++){
        const a=side[i-1],b=side[i],start=Math.max(lo,Math.min(a[1],b[1])),end=Math.min(hi,Math.max(a[1],b[1]));
        if(end-start<2 || Math.abs(b[1]-a[1])<.001)continue;
        for(const y of [start,end]){
            const edgeX=a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]);
            const localX=hip[0]+(neck[0]-hip[0])*(y-hip[1])/(neck[1]-hip[1]);
            candidates.push({x:edgeX-localX+dir*3,point:[edgeX,y]});
        }
    }
    if(!candidates.length)return null;
    const placement=candidates.reduce((best,c)=>dir*c.x>dir*best.x?c:best);
    const fraction=(placement.point[1]-hip[1])/(neck[1]-hip[1]);
    // Supporting only the pelvis/lower trunk is not back support. Keep the whole
    // torso outside the boundary, then require contact in the mid/upper back.
    if(fraction<.35 || fraction>.95)return null;
    return {...placement,fraction};
}

// Shared by schema-2 and articulated layouts: attachments always follow final joints.
export function attachProps(props,people,overhead,note){
    const owners=new Map(people.map(p=>[p.id,p]));
    return props.map(p=>{
        if(!p.heldBy)return p;
        const owner=owners.get(p.heldBy.person);
        if(p.type!=='cup' || !owner){
            const omitted=!owner && p.type==='cup';
            note(`${p.name}: held attachment supports cups with a valid participant only.`,`${p.name} ${omitted?'is not drawn because its holder is missing':'could not be attached to the intended hand'}.`);
            return omitted?null:p;
        }
        const hand=owner.joints[p.heldBy.hand==='far'?6:4];
        const dir=overhead?(owner.overheadDir ?? owner.dir):owner.dir;
        const grip=overhead?[owner.x+dir*24,owner.depth]:hand;
        return {...p,x:dir===1?grip[0]:grip[0]-14,y:grip[1]-8,w:14,h:16,depth:owner.depth,footprint:16,attachment:[...hand]};
    }).filter(Boolean);
}
