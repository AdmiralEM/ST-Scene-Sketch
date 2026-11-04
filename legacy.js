import { text } from './schema.js';
export { JOINT_NAMES as joints } from './skeleton.js';
const label = (s) => text(s,160,'Legacy label');
const number = (n, lo, hi) => { if(typeof n !== 'number' || !Number.isFinite(n)) throw Error('Coordinates must be finite numbers.'); return Math.max(lo,Math.min(hi,n)); };
export function parseScene(raw) {
    if (typeof raw !== 'string' || raw.length > 60000) throw Error('Scene response is empty or too large.');
    const data = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));
    if (!data || typeof data !== 'object' || !Array.isArray(data.people) || !data.people.length || data.people.length > 8) throw Error('Expected 1–8 people.');
    return {title:label(data.title), notes:text(data.notes,2000,'Legacy assumptions'), people:data.people.map((p,i)=>{
        if(!p || !Array.isArray(p.joints) || p.joints.length !== 11) throw Error('Each person needs exactly 11 joints.');
        return {name:label(p.name || `Person ${i+1}`), facing:label(p.facing), action:label(p.action), joints:p.joints.map(v=>{
            if(!Array.isArray(v)||v.length!==2) throw Error('Invalid joint.');
            return [number(v[0],12,788),number(v[1],25,470)];
        })};
    }), props:(Array.isArray(data.props)?data.props:[]).slice(0,12).map(p=>{
        if (!p || typeof p !== 'object') throw Error('Invalid prop.');
        const x=number(p.x,0,790), y=number(p.y,0,490);
        return {name:label(p.name),x,y,w:number(p.w,10,800-x),h:number(p.h,10,500-y)};
    })};
}
