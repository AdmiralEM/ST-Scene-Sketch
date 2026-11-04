import { EDGES } from './poses.js';
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const area=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
const inflate=(r,p)=>({x:r.x-p,y:r.y-p,w:r.w+2*p,h:r.h+2*p});
const nearest=(r,p)=>[clamp(p[0],r.x,r.x+r.w),clamp(p[1],r.y,r.y+r.h)];
export function labelLines(name){
    const chars=[...name],lines=[];
    while(chars.length){let n=Math.min(22,chars.length);if(chars.length>22){const space=chars.slice(0,23).lastIndexOf(' ');if(space>0)n=space;}lines.push(chars.splice(0,n).join('').trim());while(chars[0]===' ')chars.shift();}
    return lines.length?lines:[''];
}

// Finite local candidates, never an unbounded climb above the scene. Scoring
// trades residual crowding against distance; a displaced label has a leader.
export function placeLabels(items,obstacles){
    const occupied=[],labels=[];
    for(const item of items){
        const lines=labelLines(item.name),font=item.kind==='person'?14:13;
        const w=Math.max(1,...lines.map(s=>[...s].length))*font*.62,h=lines.length*(font+3);
        const b=item.bounds,cx=b.x+b.w/2,cy=b.y+b.h/2;
        const candidates=[
            {x:cx-w/2,y:b.y-h-9},
            {x:b.x+b.w+10,y:cy-h/2},
            {x:b.x-w-10,y:cy-h/2},
            {x:cx-w/2,y:b.y+b.h+10},
            {x:b.x+b.w+10,y:b.y-h-9},
            {x:b.x-w-10,y:b.y-h-9},
            {x:b.x+b.w+10,y:b.y+b.h+10},
            {x:b.x-w-10,y:b.y+b.h+10},
        ].map(r=>({...r,w,h}));
        const score=r=>occupied.reduce((sum,o)=>sum+area(inflate(r,4),o)*12,0)+obstacles.reduce((sum,o)=>sum+area(inflate(r,3),o)*2,0)
            +Math.hypot(...nearest(r,item.anchor).map((v,i)=>v-item.anchor[i]));
        let chosen=candidates[0],best=score(chosen),index=0;
        for(let i=1;i<candidates.length;i++){const value=score(candidates[i]);if(value<best){chosen=candidates[i];best=value;index=i;}}
        const endpoint=nearest(chosen,item.anchor),start=nearest(b,endpoint);
        const leader=index>0 && Math.hypot(endpoint[0]-start[0],endpoint[1]-start[1])>6?[start,endpoint]:null;
        const label={id:item.id,kind:item.kind,lines,font,x:chosen.x+w/2,y:chosen.y+font,w,h,bounds:chosen,anchor:item.anchor,leader,candidate:index};
        occupied.push(inflate(chosen,2));labels.push(label);
    }
    return labels;
}

export function frameScene(layout){
    const shapes=[],items=[];
    const include=r=>shapes.push(r);
    // Participant labels first: their head anchors are more precise than prop names.
    for(const p of layout.people){
        let b;
        if(layout.overhead){b={x:p.x-18,y:p.depth-20,w:36,h:40};include(b);include({x:p.x-36,y:p.depth-8,w:72,h:16});}
        else {
            for(const [a,c] of EDGES){const s=p.joints[a],e=p.joints[c];include({x:Math.min(s[0],e[0])-4,y:Math.min(s[1],e[1])-4,w:Math.abs(s[0]-e[0])+8,h:Math.abs(s[1]-e[1])+8});}
            for(const [x,y] of p.joints)include({x:x-8,y:y-4,w:16,h:8});
            for(const k of [8,10]){const [x,y]=p.joints[k];include({x:x-14,y:y-4,w:28,h:8});}
            const [x,y]=p.joints[0];b={x:x-20,y:y-16,w:40,h:32};include(b);
        }
        items.push({id:p.id,kind:'person',name:p.name,bounds:b,anchor:[b.x+b.w/2,b.y+b.h/2]});
    }
    for(const p of layout.props){
        const b=p.geometry.bounds;include(inflate(b,2));
        items.push({id:p.id,kind:'prop',name:p.name,bounds:b,anchor:p.geometry.labelAnchor});
    }
    const groundStart=Math.min(...shapes.map(s=>s.x)),groundEnd=Math.max(...shapes.map(s=>s.x+s.w));
    const labels=placeLabels(items,shapes);
    for(const label of labels){
        include(inflate(label.bounds,3));
        if(label.leader){const [a,b]=label.leader;include({x:Math.min(a[0],b[0])-1,y:Math.min(a[1],b[1])-1,w:Math.abs(a[0]-b[0])+2,h:Math.abs(a[1]-b[1])+2});}
    }
    if(!layout.overhead)include({x:groundStart,y:layout.ground-1,w:groundEnd-groundStart,h:2});
    let x=Math.min(...shapes.map(s=>s.x))-24,y=Math.min(...shapes.map(s=>s.y))-24;
    let width=Math.max(...shapes.map(s=>s.x+s.w))+24-x,height=Math.max(...shapes.map(s=>s.y+s.h))+24-y;
    if(width<360){x-=(360-width)/2;width=360;}
    if(height<240){y-=(240-height)/2;height=240;}
    return {x,y,width,height,labels,shapes,groundStart,groundEnd};
}
