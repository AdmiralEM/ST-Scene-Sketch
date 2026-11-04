// Schema-3 developer fixtures: fixed geometry, not captured provider output.
const clone=value=>JSON.parse(JSON.stringify(value));
const joints={head:[-12,-92],neck:[-8,-68],hip:[0,0],leftElbow:[-42,-26],leftHand:[-70,-50],rightElbow:[24,-91],rightHand:[24,-124],leftKnee:[-45,14],leftFoot:[-66,50],rightKnee:[42,-18],rightFoot:[62,50]};
const custom={schemaVersion:3,title:'Synthetic custom asymmetric crouch',interpretation:'Sam crouches with one hand braced on the table and the other reaching upward, with each leg folded differently.',assumptions:['This is a two-dimensional pose; force and three-dimensional contact are not validated.'],people:[{
    id:'sam',name:'Sam',description:'low asymmetric crouch; near hand braced, far hand raised',arms:'reaching',placement:{x:400,y:370,depth:260},geometry:{mode:'custom',joints,headFacing:-45},
}],props:[{id:'table',name:'Bracing surface',type:'table',x:265,y:320,w:95,h:100,depth:260,footprint:80}]};
const override={schemaVersion:3,title:'Synthetic preset and single-arm override',interpretation:'Alex stands with one arm bent up to the left while the other reaches toward Sam.',assumptions:[],people:[
    {id:'alex',name:'Alex',arms:'reaching',target:'sam',placement:{x:220,y:329,depth:260},geometry:{mode:'preset',preset:'standing',overrides:{leftElbow:[-40,-40],leftHand:[-65,-60]},headFacing:180}},
    {id:'sam',name:'Sam',placement:{x:400,y:329,depth:260},geometry:{mode:'preset',preset:'standing',headFacing:180}},
],props:[]};
const cup=clone(custom);cup.title='Synthetic cup follows custom hand';cup.interpretation='Sam holds a cup up in the far hand while crouching and bracing the other hand on the table.';cup.people[0].arms='holding';cup.props.push({id:'cup',name:'Cup',type:'cup',heldBy:{person:'sam',hand:'far'}});
const conflict=clone(custom);conflict.title='Synthetic conflicting support keeps custom pose';conflict.people[0].support={type:'on',target:'table'};
const mirror=clone(custom);mirror.title='Synthetic explicitly mirrored custom pose';mirror.people[0].geometry.transform={mirrorX:true};mirror.props[0].x=440;
const offCanvas=clone(custom);offCanvas.title='Synthetic off-canvas articulated pose';offCanvas.interpretation='Sam holds an asymmetric crouch outside the nominal canvas.';offCanvas.people[0].placement.x=-250;offCanvas.people[0].placement.y=600;offCanvas.props=[];
export const articulatedFixtures={v3_custom:custom,v3_override:override,v3_cup:cup,v3_conflict:conflict,v3_mirror:mirror,v3_offCanvas:offCanvas};
