// Schema 3: explicit geometry discriminators and local coordinates. Older schema
// parsers remain unchanged; shared text/prop semantics come from schema 2.
import { parseSemanticScene, POSES, text } from './schema.js';
import { JOINT_NAMES } from './skeleton.js';
export const LOCAL_LIMIT=1000, PLACEMENT_LIMIT=2000;
export function bounded(value,limit,field){
    if(typeof value!=='number' || !Number.isFinite(value) || Math.abs(value)>limit)throw Error(`${field} must be a finite number within ±${limit}; coordinates were not clamped.`);
    return value;
}
const object=(value,field)=>{if(!value || typeof value!=='object' || Array.isArray(value))throw Error(`${field} must be an object.`);return value;};
const bool=(value,field)=>{if(typeof value!=='boolean')throw Error(`${field} must be true or false.`);return value;};
const ref=(value,field)=>{if(typeof value!=='string' || !/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(value))throw Error(`${field} needs a valid participant/prop ID.`);};
function knownFields(data,allowed,path,warnings){
    const extras=Object.keys(data).filter(key=>!allowed.includes(key));
    if(extras.length>16)throw Error(`${path}: too many unsupported fields; remove unknown fields.`);
    for(const key of extras)warnings.push(`${path}.${text(key,100,'Field name')} is unsupported and was ignored.`);
}
function jointMap(value,complete,path){
    object(value,path);
    for(const name of Object.keys(value))if(!JOINT_NAMES.includes(name))throw Error(`${path}: unknown joint "${text(name,100,'Joint name')}". Use the documented eleven joint names.`);
    if(complete)for(const name of JOINT_NAMES)if(!Object.hasOwn(value,name))throw Error(`${path}: missing ${name}. Custom mode requires all eleven joints.`);
    const result={};
    for(const name of JOINT_NAMES)if(Object.hasOwn(value,name)){
        const pair=value[name];if(!Array.isArray(pair) || pair.length!==2)throw Error(`${path}.${name} needs exactly [x,y].`);
        result[name]=pair.map((n,i)=>bounded(n,LOCAL_LIMIT,`${path}.${name}[${i}]`));
    }
    return result;
}
function geometry(value,path,warnings){
    const g=object(value,path);
    if(!['preset','custom'].includes(g.mode))throw Error(`${path}.mode must explicitly be "preset" or "custom".`);
    knownFields(g,['mode','preset','overrides','joints','transform','headFacing'],path,warnings);
    let content;
    if(g.mode==='preset'){
        if(!POSES.includes(g.preset))throw Error(`${path}.preset is unknown. Choose an existing preset or use mode "custom" with all eleven joints.`);
        if(g.joints!=null)throw Error(`${path}: preset mode uses overrides, not joints. Choose custom mode for a complete skeleton.`);
        content={preset:g.preset,...(g.overrides==null?{}:{overrides:jointMap(g.overrides,false,path+'.overrides')})};
    } else {
        if(g.preset!=null || g.overrides!=null)throw Error(`${path}: custom mode cannot include preset or overrides.`);
        content={joints:jointMap(g.joints,true,path+'.joints')};
    }
    let transform;
    if(g.transform!=null){
        const t=object(g.transform,path+'.transform');
        if(Object.keys(t).some(k=>k!=='mirrorX'))throw Error(`${path}.transform supports only explicit mirrorX; provide rotated/scaled coordinates directly.`);
        transform={mirrorX:t.mirrorX==null?false:bool(t.mirrorX,path+'.transform.mirrorX')};
    }
    return {mode:g.mode,...content,...(transform?{transform}:{}),headFacing:g.headFacing==null?0:bounded(g.headFacing,360,path+'.headFacing')};
}
function placement(value,path,warnings){
    const p=object(value,path);knownFields(p,['x','y','depth','resolveRelations'],path,warnings);
    return {x:bounded(p.x,PLACEMENT_LIMIT,path+'.x'),y:bounded(p.y,PLACEMENT_LIMIT,path+'.y'),
        ...(p.depth==null?{}:{depth:bounded(p.depth,PLACEMENT_LIMIT,path+'.depth')}),
        resolveRelations:p.resolveRelations==null?false:bool(p.resolveRelations,path+'.resolveRelations')};
}
export function parseV3(data){
    const warnings=[];
    const geometries=[],placements=[];
    for(const [i,p] of data.people.entries()){
        object(p,`people[${i}]`);
        knownFields(p,['id','name','geometry','placement','facing','lean','arms','target','targetRegion','seat','support','beside','backSupport','contact','description'],`people[${i}]`,warnings);
        geometries.push(geometry(p.geometry,`people[${i}].geometry`,warnings));placements.push(placement(p.placement,`people[${i}].placement`,warnings));
        for(const [field,choices] of Object.entries({facing:['left','right','toward'],lean:['upright','forward','backward'],arms:['resting','raised','reaching','holding','pointing'],targetRegion:['hand','forearm','shoulder','head','neutral'],seat:['ground']}))
            if(p[field]!=null && !choices.includes(p[field]))throw Error(`people[${i}].${field} is unsupported; use explicit joints for unusual articulation instead of replacing its meaning.`);
        if(p.target!=null)ref(p.target,`people[${i}].target`);
        for(const field of ['support','backSupport','beside','contact'])if(p[field]!=null){
            object(p[field],`people[${i}].${field}`);ref(p[field].target,`people[${i}].${field}.target`);
            const keys=field==='support'?['type','target','side']:field==='contact'?['type','target']:['target','side'];
            knownFields(p[field],keys,`people[${i}].${field}`,warnings);
        }
        if(p.support && !['on','against'].includes(p.support.type))throw Error('Support type must be on or against.');
        if(p.contact && p.contact.type!=='embrace')throw Error('Unsupported contact type; retain its description and explicit geometry, rather than silently replacing it.');
        for(const field of ['support','backSupport','beside'])if(p[field]?.side!=null && !['left','right'].includes(p[field].side))throw Error(`${field}.side must be left or right.`);
    }
    if(Array.isArray(data.props))for(const p of data.props)if(p?.heldBy){object(p.heldBy,'heldBy');ref(p.heldBy.person,'heldBy.person');if(p.heldBy.hand!=null && !['near','far'].includes(p.heldBy.hand))throw Error('heldBy.hand must be near or far.');}
    // Reuse scene text, IDs, props and relationship validation without invoking
    // the old pose vocabulary or creating a placeholder/default custom posture.
    const shared=parseSemanticScene(data,{requirePose:false});
    const people=shared.people.map((p,i)=>{
        const {pose,x,depth,lean,arms,...rest}=p;
        const raw=data.people[i],g=geometries[i];
        return {...rest,facing:raw.facing ?? (g.transform?.mirrorX?'left':'right'),geometry:g,placement:placements[i],
            ...(g.mode==='preset'?{lean:lean,arms:arms}:{}),
            ...(g.mode==='custom' && raw.lean!=null?{lean}:{}),...(g.mode==='custom' && raw.arms!=null?{arms}:{}),
            ...(raw.description==null?{}:{description:text(raw.description,200,'Pose description')})};
    });
    const allWarnings=[...new Set([...shared.warnings,...warnings])];
    if(allWarnings.length>64)throw Error('Too many unsupported fields/diagnostics; simplify the scene to at most 64 validation messages.');
    return {...shared,schemaVersion:3,people,warnings:allWarnings};
}
