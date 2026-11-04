// Synthetic fixed-data rendering regressions. These are not captured model output.
// Source interpretation and renderer expectations are intentionally separate.
import { spatialFixtures,mirrorScene } from './spatial-fixtures.js';
const person=(id,name,pose,x,extra={})=>({id,name,pose,...(x==null?{}:{x}),facing:'right',arms:'resting',...extra});
const prop=(id,name,type,x,y,w,h,extra={})=>({id,name,type,x,y,w,h,...extra});
const scene=(title,interpretation,people,props=[],assumptions=[])=>({schemaVersion:2,title,interpretation,assumptions,people,props});
const table=scene('Synthetic: seated across a table','Alex and Sam sit facing each other across a table.',[
    person('alex','Alex','sitting',null,{support:{type:'on',target:'chairA'},backSupport:{target:'chairA'}}),
    person('sam','Sam','sitting',null,{facing:'left',support:{type:'on',target:'chairB'},backSupport:{target:'chairB'}}),
],[prop('chairA','Chair','chair',180,374,80,46),prop('table','Table','table',330,320,140,100),prop('chairB','Chair','chair',540,374,80,46,{facing:'left'})]);
const ground=scene('Synthetic: kneeling beside lying','Kai kneels beside Robin, who is lying on the ground.',[
    person('robin','Robin','lying',440),person('kai','Kai','kneeling',null,{beside:{target:'robin',side:'left'},facing:'right'}),
]);
const embrace=scene('Synthetic: described embrace','Alex and Sam embrace, standing close and facing each other.',[
    person('alex','Alex','standing',360,{arms:'reaching',target:'sam',targetRegion:'shoulder',contact:{type:'embrace',target:'sam'}}),
    person('sam','Sam','standing',420,{facing:'left',arms:'reaching',target:'alex',targetRegion:'shoulder',contact:{type:'embrace',target:'alex'}}),
]);
const cupDoor=scene('Synthetic: cup and doorway gesture','Alex holds a cup while Sam points toward the doorway.',[
    person('alex','Alex','standing',270,{arms:'holding'}),person('sam','Sam','standing',450,{arms:'pointing',target:'door'}),
],[{id:'cup',name:'Cup',type:'cup',heldBy:{person:'alex',hand:'near'},w:20,h:20},prop('door','Doorway','door',640,230,80,190)]);
const campfire=scene('Synthetic: three around a campfire','Alex and Sam sit on opposite sides of a campfire, with Morgan standing behind it.',[
    person('alex','Alex','sitting',210,{seat:'ground',depth:280}),person('sam','Sam','sitting',540,{seat:'ground',facing:'left',depth:280}),person('morgan','Morgan','standing',375,{depth:130}),
],[prop('fire','Campfire','campfire',340,365,70,55,{depth:250,footprint:60})]);
const spring=JSON.parse(JSON.stringify(spatialFixtures.spring));spring.title='Synthetic: ground-level spring and resting arms';spring.people[1].pose='standing';spring.people[1].arms='resting';delete spring.people[1].target;spring.people[1].facing='left';spring.props.find(p=>p.id==='spring').waterLevel='ground';spring.interpretation='Alex sits on the bank leaning back against a rock while Sam stands nearby, facing Alex.';
const elevated=scene('Synthetic: elevated water basin','Alex stands beside an elevated basin filled with water.',[person('alex','Alex','standing',500)],[prop('basin','Basin','box',220,310,180,100),prop('water','Water','pool',224,310,172,30,{waterLevel:'elevated',surfaceY:310})]);
export const regressionCases=[
    {id:'table',source:'Two people sit facing each other across a table.',scene:table,expected:['Hips on each chair seat','Faces point across table','Table behind people'],limitations:['Schematic proportions, not physical validation']},
    {id:'ground',source:'Kai kneels beside Robin, who lies on the ground.',scene:ground,expected:['One knee at ground','Lying head and body near ground','No furniture support inferred'],limitations:['Side projection does not specify hidden depth']},
    {id:'embrace',source:'Alex and Sam embrace, facing one another.',scene:embrace,expected:['Two distinct close figures','Explicit embrace meaning retained','Visible unresolved-embrace limitation'],limitations:['Wraparound embrace/contact is not reliably solved; do not classify as a successful hug renderer']},
    {id:'cupDoor',source:'Alex holds a cup. Sam points toward the doorway.',scene:cupDoor,expected:['Cup attached to near hand','Bent holding arm and resting far arm','Pointing gesture aims toward doorway'],limitations:['Hand grasp detail is omitted','Overhead cup is an owner-adjacent symbol, not a hand reconstruction']},
    {id:'campfire',source:'Two people sit across a campfire while a third stands behind it.',scene:campfire,expected:['Three distinct participants','Ground-level fire','Depth retained for overhead view'],limitations:['Side projection collapses front/back positions and may overlap the rear person with the fire']},
    {id:'spring',source:'Alex sits on the bank, back against a rock; Sam stands facing Alex beside a ground-level spring.',scene:spring,expected:['Ground-level hip','Back contact in mid/upper torso','Bank interrupts across water','Separated resting hands','No reaching disclaimer'],limitations:['Exact shoreline shape is unspecified']},
    {id:'springMirror',source:'The same bank/support scene viewed with left and right mirrored.',scene:mirrorScene(spring),expected:['Mirrored back contact and limbs','Same ground and water level'],limitations:['Synthetic mirror, not a second interpretation']},
    {id:'cupMirror',source:'The cup and pointing scene with left and right mirrored.',scene:mirrorScene(cupDoor),expected:['Cup stays with the same hand role','Pointing direction mirrors'],limitations:['Near/far are projection roles, not anatomical left/right']},
    {id:'embraceMirror',source:'The described embrace with left and right mirrored.',scene:mirrorScene(embrace),expected:['Contact semantics retained','Unresolved-embrace limitation retained'],limitations:['No wraparound contact solver']},
    {id:'elevated',source:'A person stands beside an elevated basin of water.',scene:elevated,expected:['Water stays at explicit height','Ground continues beneath basin'],limitations:['Basin is schematic']},
];
export const regressionScenes=Object.fromEntries(regressionCases.map(c=>['case_'+c.id,c.scene]));
