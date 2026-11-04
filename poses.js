// Small deterministic pose/layout engine. Units are schematic, not physical measures.
export const GROUND = 420;
export const EDGES = [[0,1],[1,2],[1,3],[3,4],[1,5],[5,6],[2,7],[7,8],[2,9],[9,10]];
const radians = degrees => degrees*Math.PI/180;
const point = (origin,length,angle) => [origin[0]+length*Math.cos(radians(angle)),origin[1]+length*Math.sin(radians(angle))];
const add = (a,b) => [a[0]+b[0],a[1]+b[1]];
export function bentArm(origin,destination,sign=1,max=64,gap=0){
    const distance=Math.hypot(destination[0]-origin[0],destination[1]-origin[1]);
    const reach=Math.min(max,Math.max(4,distance-gap));
    const angle=Math.atan2(destination[1]-origin[1],destination[0]-origin[0])*180/Math.PI;
    const bend=Math.acos((34**2+reach**2-32**2)/(2*34*reach))*180/Math.PI;
    return [point(origin,34,angle+sign*bend),point(origin,reach,angle)];
}


// All presets use the same torso (66), arm segments (34/32), leg segments (46).
// Pose space faces right, origin at the hip. Mirroring happens only at the end.
export function poseJoints(pose, {x=0,baseline=GROUND,hipY,dir=1,lean='upright',arms='resting',target,groundSeated=false,holdingHand='near'}={}) {
    const baseHip={standing:baseline-2*Math.sqrt(46**2-8**2),sitting:baseline-46,kneeling:baseline-46,reclining:baseline-4,lying:baseline-4}[pose];
    const hip=[0,hipY ?? baseHip];
    let torsoAngle=pose==='lying'?180:pose==='reclining'?-145:-90;
    if(pose!=='lying')torsoAngle+=lean==='forward'?25:lean==='backward'?-25:0;
    const neck=point(hip,66,torsoAngle),head=pose==='lying'?add(neck,[-Math.sqrt(22**2-8**2),-8]):point(neck,22,torsoAngle);
    let kneeA,footA,kneeB,footB;
    if(pose==='standing') {
        kneeA=add(hip,[-8,Math.sqrt(46**2-8**2)]);footA=add(kneeA,[-8,Math.sqrt(46**2-8**2)]);
        kneeB=add(hip,[8,Math.sqrt(46**2-8**2)]);footB=add(kneeB,[8,Math.sqrt(46**2-8**2)]);
    } else if(pose==='kneeling') {
        kneeA=add(hip,[0,46]);footA=add(kneeA,[-46,0]);
        kneeB=add(hip,[46,0]);footB=add(kneeB,[0,46]);
    } else {
        const angle=pose==='sitting'?0:pose==='reclining'?-8:0;
        kneeA=point(hip,46,angle);footA=point(kneeA,46,pose==='sitting'?90:8);
        kneeB=point(hip,46,angle+8);footB=point(kneeB,46,pose==='sitting'?82:0);
        if(pose==='sitting'){
            kneeB=point(hip,46,-8);footB=point(kneeB,46,90);
            if(hipY!=null && hipY>baseline-46){
                kneeA=point(hip,46,-30);kneeB=point(hip,46,-25);
                footA=[kneeA[0]+Math.sqrt(46**2-(baseline-kneeA[1])**2),baseline];
                footB=[kneeB[0]+Math.sqrt(46**2-(baseline-kneeB[1])**2),baseline];
            }
            if(groundSeated){
                kneeA=point(hip,46,-20);footA=point(kneeA,46,20);
                kneeB=point(hip,46,-12);footB=point(kneeB,46,12);
            }
        }
        if(pose==='lying'){
            kneeA=point(hip,46,0);footA=point(kneeA,46,0);
            kneeB=point(hip,46,-8);footB=point(kneeB,46,8);
        }
    }
    let upper=70,lower=100;
    if(arms==='raised'){upper=-110;lower=-70;}
    else if(pose==='lying'){upper=-15;lower=5;}
    else if(pose==='reclining'){upper=15;lower=-5;}
    let elbowA=point(neck,34,upper),handA=point(elbowA,32,lower);
    const armOffset=pose==='lying' && arms==='resting'?-8:12;
    let elbowB=point(neck,34,upper+armOffset),handB=point(elbowB,32,lower+armOffset);
    if(arms==='resting' || arms==='holding' || arms==='pointing'){
        if(pose!=='lying' && pose!=='reclining'){
            // Near/far projection offsets, not an assertion that both arms occupy
            // one anatomical side. Hands stay clear of the pelvis and torso.
            [elbowA,handA]=bentArm(neck,[hip[0]+18+Math.max(0,neck[0])*.5,hip[1]-16],-1);
            [elbowB,handB]=bentArm(neck,[hip[0]-20+Math.min(0,neck[0])*.7,hip[1]-14],1);
        }
        if(arms==='holding'){
            const arm=bentArm(neck,[neck[0]+38,neck[1]+28],1);
            if(holdingHand==='far')[elbowB,handB]=arm;else [elbowA,handA]=arm;
        }
        if(arms==='pointing'){
            const destination=target?[(target[0]-x)*dir,target[1]]:[neck[0]+100,neck[1]];
            [elbowA,handA]=bentArm(neck,destination,-1,62);
        }
    }
    if(arms==='reaching'){
        const destination=target?[(target[0]-x)*dir,target[1]]:[neck[0]+100,neck[1]+36];
        const distance=Math.hypot(destination[0]-neck[0],destination[1]-neck[1]);
        // A short gap conveys intent rather than asserting a touch. Beyond-reach
        // targets only change direction, not limb lengths.
        const reach=Math.min(62,Math.max(16,distance-8));
        const angle=Math.atan2(destination[1]-neck[1],destination[0]-neck[0])*180/Math.PI;
        const bend=Math.acos((34**2+reach**2-32**2)/(2*34*reach))*180/Math.PI;
        elbowA=point(neck,34,angle-bend);handA=point(neck,reach,angle);
        elbowB=point(neck,34,angle-bend+10);handB=point(neck,reach,angle+10);
    }
    return [head,neck,hip,elbowA,handA,elbowB,handB,kneeA,footA,kneeB,footB].map(([px,py])=>[x+dir*px,py]);
}
