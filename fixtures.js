// Non-explicit synthetic regression scenes. Also used by the free browser fixture.
const person=(id,name,pose,x,extra={})=>({id,name,pose,...(x==null?{}:{x}),facing:'right',lean:'upright',arms:'resting',...extra});
const prop=(id,name,type,x,y,w,h,extra={})=>({id,name,type,x,y,w,h,...extra});
const scene=(title,interpretation,people,props=[],assumptions=[])=>({schemaVersion:2,title,interpretation,assumptions,people,props});
export const fixtures={
    A:scene('Standing conversation','Alex and Sam stand facing each other, talking across a small gap.',[
        person('alex','Alex','standing',280,{facing:'toward',target:'sam'}),person('sam','Sam','standing',470,{facing:'toward',target:'alex'})]),
    B:scene('Chair beside table','Alex sits on the chair to the left of the table.',[
        person('alex','Alex','sitting',null,{support:{type:'on',target:'chair'}})],
        [prop('chair','Chair','chair',240,374,80,46),prop('table','Table','table',400,330,160,90)]),
    C:scene('Beside the stone and pool','Alex sits leaning back against a stone. Sam kneels to Alex’s right, reaching toward Alex, with a pool to the left.',[
        person('alex','Alex','sitting',null,{support:{type:'against',target:'rock'}}),
        person('sam','Sam','kneeling',null,{facing:'toward',target:'alex',arms:'reaching',beside:{target:'alex',side:'right'}})],
        [prop('rock','Stone','stone',250,340,130,80),prop('pool','Pool','pool',60,390,160,50)],['Reaching describes intention; contact is not specified.']),
    D:scene('Resting on bed','Alex lies on the bed while Sam stands to its right.',[
        person('alex','Alex','lying',null,{support:{type:'on',target:'bed'}}),person('sam','Sam','standing',null,{facing:'left',beside:{target:'bed',side:'right'}})],
        [prop('bed','Bed','bed',180,350,280,70)]),
    E:scene('Group with longer names','Four visitors stand in a row; the second visitor raises their arms.',[
        person('a','Alexandra of the Northern Observatory','standing',100),person('b','Samuel the Visiting Cartographer','standing',280,{arms:'raised'}),
        person('c','Morgan from the Riverside Workshop','standing',460),person('d','Taylor the Patient Librarian','standing',640)]),
    F:scene('Invalid relationship fallbacks','The participants use approximate fallback placement because several relationships are inconsistent.',[
        person('a','Alex','sitting',200,{support:{type:'on',target:'chair'},beside:{target:'b',side:'left'},target:'missing',facing:'toward'}),
        person('b','Sam','kneeling',400,{beside:{target:'c',side:'right'},target:'missing',arms:'reaching'}),
        person('c','Morgan','standing',600,{beside:{target:'b',side:'left'}}),
        person('d','Taylor','standing',100,{beside:{target:'missing',side:'right'}})],
        [prop('chair','Unknown seat','unrecognized-kind',160,374,80,46)]),
    G:{title:'Saved coordinate sketch',notes:'Original coordinate-based saved scene; no interpretation or depth was stored.',people:[{name:'Legacy Alex',facing:'left',action:'standing',joints:[[200,280],[200,302],[200,368],[185,330],[190,360],[220,330],[230,355],[190,412],[182,458],[212,412],[220,458]]}],props:[{name:'Old box',x:300,y:390,w:100,h:90}]},
    H:scene('Five pose presets','Five separate figures demonstrate standing, sitting, kneeling, reclining and lying poses.',[
        person('a','Standing','standing',80),person('b','Sitting','sitting',240),person('c','Kneeling','kneeling',400),person('d','Reclining','reclining',560),person('e','Lying','lying',720)]),
};
