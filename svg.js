import { layoutScene, frameScene, EDGES } from './layout.js';
import { groundSegments } from './props.js';
const colors=['#60a5fa','#f472b6','#34d399','#fbbf24','#c084fc','#fb923c','#67e8f9','#fda4af'];
export const escapeXML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const line=(a,b,extra='')=>`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" ${extra}/>`;
function propShape(p) {
    const shapes=p.geometry.shapes.map(shape=>{
        const {tag,...attributes}=shape;
        const attrs=Object.entries(attributes).map(([key,value])=>`${key}="${Array.isArray(value)?value.map(point=>point.join(',')).join(' '):value}"`).join(' ');
        return `<${tag} ${attrs}/>`;
    }).join('');
    return `<g data-prop="${escapeXML(p.id)}" fill="#263347" stroke="#64748b" stroke-width="1.6" stroke-linejoin="round"><title>${escapeXML(p.name)}</title>${shapes}</g>`;
}
export function renderSVG(scene,view='side') {
    const layout=layoutScene(scene,view),frame=frameScene(layout);
    // Ground water sits behind props. Explicitly elevated water is painted over
    // its basin rather than disappearing under the supporting box's fill.
    const elevated=p=>p.type==='pool' && !layout.overhead && p.geometry.water && !p.geometry.water.grounded;
    const props=[...layout.props.filter(p=>p.type==='pool' && !elevated(p)),...layout.props.filter(p=>p.type!=='pool'),...layout.props.filter(elevated)].map(p=>propShape(p)).join('');
    const people=layout.people.map((p,i)=>{
        const color=colors[i%colors.length];
        let drawing;
        if(layout.overhead){
            const {x,depth:y}=p,dir=p.overheadDir ?? p.dir;
            drawing=`<ellipse cx="${x}" cy="${y}" rx="14" ry="16" fill="#111827"/>${line([x+dir*14,y],[x+dir*32,y])}${line([x+dir*32,y],[x+dir*25,y-5])}${line([x+dir*32,y],[x+dir*25,y+5])}`;
        } else {
            const j=p.joints,[hx,hy]=j[0];
            drawing=EDGES.map(([a,b])=>line(j[a],j[b])).join('');
            drawing+=line([j[1][0]-6,j[1][1]],[j[1][0]+6,j[1][1]])+line([j[2][0]-6,j[2][1]],[j[2][0]+6,j[2][1]]);
            drawing+=`<circle cx="${hx}" cy="${hy}" r="12" fill="#111827"/>`;
            if(p.headAngle!=null){
                const angle=p.headAngle*Math.PI/180;
                const points=[[11,-3],[17,0],[11,3]].map(([x,y])=>[hx+x*Math.cos(angle)-y*Math.sin(angle),hy+x*Math.sin(angle)+y*Math.cos(angle)]);
                drawing+=`<polyline data-head-facing="${p.headAngle}" points="${points.map(point=>point.join(',')).join(' ')}" stroke-width="2" fill="none"/>`;
            } else drawing+=`<path d="M ${hx+p.dir*11} ${hy-2} l ${p.dir*6} 5 l ${-p.dir*6} 0" stroke-width="2" fill="none"/>`;
            for(const k of [4,6])drawing+=`<circle cx="${j[k][0]}" cy="${j[k][1]}" r="3" stroke-width="2"/>`;
            for(const k of [8,10])drawing+=line(j[k],[j[k][0]+p.dir*10,j[k][1]],'stroke-width="4"');
        }
        return `<g data-person="${escapeXML(p.id)}" stroke="${color}" fill="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><title>${escapeXML(`${p.name}: ${p.action}; facing ${p.facing}`)}</title>${drawing}</g>`;
    }).join('');
    const labels=frame.labels.map(label=>{
        const personIndex=layout.people.findIndex(p=>p.id===label.id);
        const fill=label.kind==='person'?colors[personIndex%colors.length]:'#cbd5e1';
        const leader=label.leader?line(label.leader[0],label.leader[1],'stroke="#94a3b8" stroke-width="1" opacity=".65"'):'';
        return `${leader}<g fill="${fill}" font-family="monospace" font-size="${label.font}" text-anchor="middle" stroke="#111827" stroke-width="3" paint-order="stroke">${label.lines.map((s,i)=>`<text x="${label.x}" y="${label.y+i*(label.font+3)}" textLength="${[...s].length*label.font*.62}" lengthAdjust="spacingAndGlyphs">${escapeXML(s)}</text>`).join('')}</g>`;
    }).join('');
    const purpose=layout.overhead?'Overhead positions and facing only; posture is shown in pose view.'+(layout.articulated?' Custom side-view joints are not an overhead projection; markers use supplied placement.':''):layout.legacy && view==='top-down'?'Legacy coordinates shown unchanged; no overhead depth was stored.':'Side pose view; approximate scene blocking.';
    const background=`<rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" fill="#111827"/>`;
    const ground=layout.overhead?'':groundSegments(layout.props,frame.groundStart,frame.groundEnd).map(([a,b])=>line([a,layout.ground],[b,layout.ground],'data-ground="true" stroke="#475569" stroke-width="2"')).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${frame.x} ${frame.y} ${frame.width} ${frame.height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeXML(scene.title || 'Scene positioning sketch')}"><title>${escapeXML(scene.title)}</title><desc>${escapeXML(purpose+' '+(scene.interpretation || ''))}</desc>${background}${ground}${props}${people}${labels}</svg>`;
}
