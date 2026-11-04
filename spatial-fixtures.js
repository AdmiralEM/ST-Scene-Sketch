// Synthetic reproductions, NOT exported user chat/model output. Original exported
// spring JSON was not present in the checkout. Keep the earlier A-H fixtures too.
import { fixtures } from './fixtures.js';
const clone=data=>JSON.parse(JSON.stringify(data));
const spring={schemaVersion:2,title:'Synthetic spring-bank reproduction',interpretation:'Alex sits on the bank with their back against a stone. Sam kneels nearby and reaches toward Alex, beside the spring.',assumptions:['The exact shoreline and distance to the spring are not specified.'],people:[
    {id:'alex',name:'Alex',pose:'sitting',seat:'ground',facing:'right',lean:'backward',arms:'resting',support:{type:'against',target:'rock',side:'right'}},
    {id:'sam',name:'Sam',pose:'kneeling',facing:'toward',target:'alex',arms:'reaching',beside:{target:'alex',side:'right'}},
],props:[{id:'rock',name:'Supporting stone',type:'rock',x:260,y:310,w:180,h:110},{id:'spring',name:'Natural spring',type:'natural spring',x:50,y:330,w:180,h:170}]};
export function mirrorScene(data){
    const result=clone(data),flip=v=>v==='left'?'right':v==='right'?'left':v;
    for(const p of result.people){if(p.x!=null)p.x=800-p.x;p.facing=flip(p.facing);if(p.beside)p.beside.side=flip(p.beside.side);for(const s of [p.support,p.backSupport])if(s?.side)s.side=flip(s.side);}
    for(const p of result.props){if(p.x!=null)p.x=800-p.x-(p.w ?? 100);p.facing=flip(p.facing ?? 'right');}
    return result;
}
const chair=clone(fixtures.B);chair.title='Synthetic chair and back support';chair.people[0].backSupport={target:'chair'};
const reach=(x,region)=>({schemaVersion:2,title:`Synthetic ${x<400?'near':'far'} reach${region?' to '+region:''}`,interpretation:'Alex reaches toward Sam without an established touch.',assumptions:[],props:[],people:[
    {id:'alex',name:'Alex',pose:'standing',x:280,facing:'right',arms:'reaching',target:'sam',...(region?{targetRegion:region}:{})},
    {id:'sam',name:'Sam',pose:'standing',x,facing:'left'},
]});
const labels=clone(spring);labels.title='Synthetic compact long labels';labels.people[0].name='Alexandra of the Riverside Observatory';labels.people[1].name='Samuel the Visiting Cartographer';labels.props[0].name='A broad weathered stone beside the bank';labels.props[1].name='The little natural spring beneath the hillside';labels.people[1].x=470;delete labels.people[1].beside;
const invalid=clone(spring);invalid.title='Synthetic unknown props and missing support';invalid.people[0].support.target='absent';invalid.props[0].type='unrecognized';delete invalid.props[0].w;delete invalid.props[0].h;
export const spatialFixtures={spring,mirror:{...mirrorScene(spring),title:'Synthetic mirrored spring bank'},chairBack:chair,bed:clone(fixtures.D),near:reach(335),far:reach(560),head:reach(335,'head'),labels,invalid,oldV2:clone(fixtures.C),oldCoordinates:clone(fixtures.G)};
