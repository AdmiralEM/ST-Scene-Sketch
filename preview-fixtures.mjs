// Developer-only SVG fixture export. No build step or runtime dependency.
// node preview-fixtures.mjs [output-directory] [optional-existing-sharp-module-path]
import { mkdir,writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { fixtures } from './fixtures.js';
import { spatialFixtures } from './spatial-fixtures.js';
import { regressionCases,regressionScenes } from './regression-cases.js';
import { articulatedFixtures } from './articulated-fixtures.js';
import { parseScene,renderSVG } from './scene.js';
const output=process.argv[2] || join(tmpdir(),'scene-sketch-fixtures');
await mkdir(output,{recursive:true});
const sharp=process.argv[3]?createRequire(import.meta.url)(process.argv[3]):null;
const tiles=[];
let gallery='<!doctype html><meta charset="utf-8"><title>Scene Sketch fixture gallery</title><style>body{background:#202530;color:#eee;font:16px system-ui}section{display:flex;flex-wrap:wrap;gap:16px}figure{width:min(640px,95vw);margin:8px}img{width:100%;height:300px;object-fit:contain;background:#111827}</style><h1>Synthetic fixtures · pose and overhead</h1>';
const scenes={...fixtures,...spatialFixtures,...regressionScenes,...articulatedFixtures};
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let row=0;
for(const [key,data] of Object.entries(scenes)) {
    const scene=parseScene(JSON.stringify(data));
    gallery+=`<h2>Fixture ${key}</h2><section>`;
    const record=regressionCases.find(c=>'case_'+c.id===key);
    if(record)gallery+=`<div><p>Source (synthetic): ${escape(record.source)}</p><p>Expected: ${record.expected.map(escape).join('; ')}</p><p>Limitations: ${record.limitations.map(escape).join('; ')}</p></div>`;
    for(const [col,view] of ['side','top-down'].entries()){
        const svg=renderSVG(scene,view),name=`${key}-${view}`;
        await writeFile(join(output,name+'.svg'),svg);
        gallery+=`<figure><figcaption>${key}: ${view}</figcaption><img src="${name}.svg" alt="Synthetic fixture ${key}, ${view}"></figure>`;
        if(sharp){
            const tile=await sharp(Buffer.from(svg)).resize(680,300,{fit:'contain',background:'#111827'}).png().toBuffer();
            await writeFile(join(output,name+'.png'),tile);
            const narrow=await sharp(Buffer.from(svg)).resize(320,360,{fit:'contain',background:'#111827'}).png().toBuffer();
            await writeFile(join(output,name+'-narrow.png'),narrow);
            tiles.push({input:tile,left:col*700,top:row*320});
        }
    }
    gallery+='</section>';
    row++;
}
await writeFile(join(output,'index.html'),gallery);
if(sharp)await sharp({create:{width:1400,height:row*320,channels:4,background:'#202530'}}).composite(tiles).png().toFile(join(output,'contact-sheet.png'));
console.log(output);
