// Versioned model-output validation. No model-supplied markup or geometry is executed.
export const POSES = ['standing','sitting','kneeling','reclining','lying'];
export const PROP_TYPES = ['box','chair','table','bed','stone','pool','door','cup','campfire'];
const PROP_ALIASES = new Map([
    ['rock','stone'],['boulder','stone'],['spring','pool'],['natural spring','pool'],['water','pool'],['water area','pool'],['pond','pool'],
    ['seat','chair'],['stool','chair'],['counter','table'],['bench','bed'],['opening','door'],['doorway','door'],['wall','door'],['unknown','box'],['object','box'],
]);
export function finite(value, lo, hi) {
    if(typeof value !== 'number' || !Number.isFinite(value))throw Error('Coordinates must be finite numbers.');
    return Math.max(lo,Math.min(hi,value));
}
export function text(value, limit, field, required=false) {
    if(value == null && !required)return '';
    if(typeof value !== 'string' || (required && !value.trim()))throw Error(`${field} must be ${required?'a nonempty':'a'} string.`);
    if([...value].length > limit)throw Error(`${field} exceeds ${limit} characters. Shorten the field; it was not truncated.`);
    if(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/u.test(value) || /[\uD800-\uDFFF]/u.test(value))throw Error(`${field} contains unsupported text characters.`);
    return value.trim();
}
const object = (v, field) => {if(!v || typeof v!=='object' || Array.isArray(v))throw Error(`Invalid ${field}.`);return v;};
const id = (v,field) => {if(typeof v!=='string' || !/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(v))throw Error(`${field} needs a stable ID (letter followed by up to 31 letters, digits, _ or -).`);return v;};
const option = (value, choices, fallback, warnings, field) => {
    if(value == null)return fallback;
    if(choices.includes(value))return value;
    warnings.push(`${field}: unknown value; using ${fallback}.`);return fallback;
};
export function parseSemanticScene(data,{requirePose=true}={}) {
    const warnings=[];
    const reference=(value,field)=>{
        if(typeof value==='string' && /^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(value))return value;
        warnings.push(`${field}: missing or invalid target; relationship ignored.`);return undefined;
    };
    if(!Array.isArray(data.props ?? []) || (data.props?.length ?? 0)>12)throw Error('Expected at most 12 props.');
    if(!Array.isArray(data.assumptions ?? []) || (data.assumptions?.length ?? 0)>8)throw Error('Expected at most 8 assumptions.');
    if(!Array.isArray(data.warnings ?? []) || (data.warnings?.length ?? 0)>64)throw Error('Expected at most 64 validation warnings.');
    const assumptions=(data.assumptions ?? []).map(s=>text(s,600,'Assumption',true));
    const props=(data.props ?? []).map(raw=>{
        const p=object(raw,'prop'), pid=id(p.id,'Prop');
        let heldBy;
        if(p.heldBy!=null){const held=object(p.heldBy,'held object'),person=reference(held.person,`Held object ${pid}`);if(person)heldBy={person,hand:option(held.hand,['near','far'],'near',warnings,`Held hand for ${pid}`)};}
        const x=finite(p.x ?? (heldBy?0:undefined),0,780),y=finite(p.y ?? (heldBy?0:undefined),0,420);
        const suppliedType=typeof p.type==='string'?p.type.toLowerCase().trim():p.type;
        const type=option(PROP_ALIASES.get(suppliedType) ?? suppliedType,PROP_TYPES,'box',warnings,`Prop ${pid}`);
        return {id:pid,name:text(p.name,100,'Prop name',true),type,facing:option(p.facing,['left','right'],'right',warnings,`Prop facing for ${pid}`),x,y,w:finite(p.w ?? 100,20,Math.min(500,800-x)),h:finite(p.h ?? 60,10,Math.min(400,500-y)),
            ...(p.depth==null?{}:{depth:finite(p.depth,0,500)}),...(p.footprint==null?{}:{footprint:finite(p.footprint,20,300)}),
            ...(p.waterLevel==null?{}:{waterLevel:option(p.waterLevel,['ground','elevated'],'ground',warnings,`Water level for ${pid}`)}),
            ...(p.surfaceY==null?{}:{surfaceY:finite(p.surfaceY,0,480)}),...(heldBy?{heldBy}:{})};
    });
    const people=data.people.map(raw=>{
        const p=object(raw,'person'),pid=id(p.id,'Person');
        if(requirePose && p.pose==null)warnings.push(`Pose for ${pid}: missing value; using standing.`);
        let support,beside,backSupport;
        if(p.support!=null){
            const s=object(p.support,'support'),target=reference(s.target,`Support for ${pid}`);
            if(!['on','against'].includes(s.type))warnings.push(`Support for ${pid}: unknown support type; relationship ignored.`);
            else if(target)support={type:s.type,target,...(s.side==null?{}:{side:option(s.side,['left','right'],'right',warnings,`Support side for ${pid}`)})};
        }
        if(p.backSupport!=null){const b=object(p.backSupport,'back support'),target=reference(b.target,`Back support for ${pid}`);if(target)backSupport={target,...(b.side==null?{}:{side:option(b.side,['left','right'],'right',warnings,`Back support side for ${pid}`)})};}
        if(p.beside!=null){const b=object(p.beside,'beside relationship'),target=reference(b.target,`Beside for ${pid}`);if(target)beside={target,side:option(b.side,['left','right'],'right',warnings,`Beside side for ${pid}`)};}
        const target=p.target==null?undefined:reference(p.target,`Interaction for ${pid}`);
        let contact;
        if(p.contact!=null){const c=object(p.contact,'contact'),other=reference(c.target,`Contact for ${pid}`);if(c.type==='embrace' && other)contact={type:'embrace',target:other};else warnings.push(`Contact for ${pid}: unsupported type or missing target; no contact resolved.`);}
        if(p.seat!=null && p.seat!=='ground')warnings.push(`Seat for ${pid}: unknown value; ordinary pose placement retained.`);
        return {id:pid,name:text(p.name,100,'Participant name',true),...(requirePose?{pose:option(p.pose,POSES,'standing',warnings,`Pose for ${pid}`)}:{}),
            facing:option(p.facing,['left','right','toward'],'right',warnings,`Facing for ${pid}`),lean:option(p.lean,['upright','forward','backward'],'upright',warnings,`Lean for ${pid}`),
            arms:option(p.arms,['resting','reaching','raised','holding','pointing'],'resting',warnings,`Arms for ${pid}`),
            ...(p.seat==='ground'?{seat:'ground'}:{}),
            ...(p.targetRegion==null?{}:{targetRegion:option(p.targetRegion,['hand','forearm','shoulder','head','neutral'],'neutral',warnings,`Reach region for ${pid}`)}),
            ...(p.x==null?{}:{x:finite(p.x,0,800)}),...(p.depth==null?{}:{depth:finite(p.depth,0,500)}),
            ...(target?{target}:{}),...(support?{support}:{}),...(beside?{beside}:{}),...(backSupport?{backSupport}:{}),...(contact?{contact}:{})};
    });
    const ids=[...people,...props].map(p=>p.id);
    if(new Set(ids).size!==ids.length)throw Error('Participant and prop IDs must be unique.');
    return {schemaVersion:2,title:text(data.title,120,'Title'),interpretation:text(data.interpretation,600,'Scene interpretation',true),assumptions,people,props,
        // Preserve validation fallback explanations across JSON export/reload.
        warnings:[...new Set([...(data.warnings ?? []).map(s=>text(s,600,'Warning',true)),...warnings])]};
}
export function parseV2(data){return parseSemanticScene(data);}
