import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEY } from './runtime.js';
import { fixtures } from './fixtures.js';
import { spatialFixtures } from './spatial-fixtures.js';
import { regressionScenes } from './regression-cases.js';
import { articulatedFixtures } from './articulated-fixtures.js';

// Minimal DOM contract: behavior coverage, not a browser layout test.
class Element {
    constructor(tag) { this.tag=tag;this.children=[];this.listeners={};this.attributes={};this.value=''; }
    append(e) { this.children.push(e);e.parent=this; }
    setAttribute(name,value) { this.attributes[name]=value; }
    addEventListener(name,fn) { this.listeners[name]=fn; }
    replaceChildren() { this.children=[]; }
    remove() { if(this.parent)this.parent.children=this.parent.children.filter(e=>e!==this); }
    showModal() { this.open=true; }
    click() { this.onclick?.(); }
    close() { this.open=false;this.listeners.close?.(); }
}
const all = root => [root,...root.children.flatMap(all)];
const sample=JSON.stringify({title:'Fixture',people:[{name:'A',joints:Array.from({length:11},()=>[100,100])}],props:[]});

test('native entry points, defaults, bounded generation, errors and lifecycle with a mock response',async()=>{
    const body=new Element('body'),host=new Element('div'),menu=new Element('div');host.id='extensions_settings2';menu.id='extensionsMenu';body.append(host);
    const events=new Map();
    let saves=0,calls=0,settingsSaves=0,menuDismissals=0,resolve,reject,options;
    const c={chatId:'fixture',characterId:0,chat:[{name:'A',mes:'A sits.'}],chatMetadata:{},extensionSettings:{[KEY]:{custom:'preserved'}},
        saveSettingsDebounced(){settingsSaves++;},async saveMetadata(){saves++;},
        generateRaw(o){calls++;options=o;return new Promise((yes,no)=>{resolve=yes;reject=no;});},
        eventTypes:Object.fromEntries(['APP_INITIALIZED','APP_READY','CHAT_CHANGED','MESSAGE_EDITED','MESSAGE_SWIPED','MESSAGE_RECEIVED'].map(e=>[e,e])),
        eventSource:{on(e,fn){assert.ok(!events.has(e),'handler registered only once');events.set(e,fn);}}};
    const find=id=>all(body).find(e=>e.id===id);
    globalThis.document={body,documentElement:{click(){menuDismissals++;menu.hidden=true;assert.equal(find('ss-dialog')?.open===true,false,'menu dismissed before opening the new panel');}},readyState:'complete',createElement:tag=>new Element(tag),querySelector:selector=>find(selector.slice(1))};
    globalThis.SillyTavern={getContext:()=>c};
    try {
        await import('./index.js');
        body.append(menu); // Core's wand menu can appear after the extension module loads.
        events.get('APP_INITIALIZED')();events.get('APP_READY')();
        assert.equal(all(body).filter(e=>e.id==='ss-settings').length,1);
        assert.equal(all(body).filter(e=>e.id==='ss-sketch').length,1);
        assert.equal(calls,0,'loading and initialization never generate');
        assert.ok(all(find('ss-settings')).some(e=>e.className==='inline-drawer-toggle inline-drawer-header'));
        const count=find('ss-default-count'),view=find('ss-default-view');
        count.value='3.8';view.value='top-down';count.onchange();
        assert.deepEqual(c.extensionSettings[KEY],{custom:'preserved',count:3,view:'top-down'});assert.equal(settingsSaves,1);
        const open=()=>{find('ss-open').onclick();return find('ss-dialog');};
        const generate=d=>all(d).find(e=>e.tag==='button' && ['Generate','Regenerate','Generating…'].includes(e.textContent));
        const button=(d,text)=>all(d).find(e=>e.textContent===text);
        const status=d=>all(d).find(e=>e.className==='ss-status');
        let d=open();assert.equal(calls,0,'settings open does not generate');
        assert.equal(all(d).find(e=>e.tag==='select').value,'top-down');assert.equal(all(d).find(e=>e.tag==='input').value,3);
        assert.equal(all(d).find(e=>e.tag==='details').open,undefined,'advanced JSON starts collapsed');
        const action=find('ss-sketch');assert.equal(action.title,'Sketch Current Scene');assert.equal(action.attributes['aria-label'],'Sketch Current Scene');
        assert.equal(action.parent.parent,menu,'entry is inside the existing wand menu');
        assert.equal(action.className,'list-group-item flex-container flexGap5');
        assert.match(find('ss-action-icon').className,/fa-person/);
        d.close();menu.hidden=false;
        const pending=action.onclick();d=find('ss-dialog');
        assert.equal(menuDismissals,1);assert.equal(menu.hidden,true,'mouse action dismisses menu');
        assert.equal(calls,1);assert.ok(options.prompt.includes('View: top-down'));assert.ok(options.prompt.includes('A sits.'));
        assert.equal(options.responseLength,1800);assert.equal(options.trimNames,false);
        assert.equal(action.attributes['aria-disabled'],'true');assert.equal(action.attributes['aria-busy'],'true');assert.match(find('ss-action-icon').className,/fa-spin/);
        await action.onclick();await generate(d).onclick();assert.equal(calls,1,'duplicates blocked');assert.equal(menuDismissals,1);
        resolve(sample);await pending;
        assert.equal(saves,1);assert.equal(c.chatMetadata[KEY].scene.title,'Fixture');assert.equal(generate(d).textContent,'Regenerate');assert.equal(action.attributes['aria-disabled'],'false');
        const canvas=all(d).find(e=>e.className==='ss-canvas'),oldSvg=canvas.innerHTML;
        const editor=all(d).find(e=>e.tag==='textarea');editor.value='{';button(d,'Apply edits').onclick();assert.equal(status(d).attributes['data-state'],'error');assert.equal(canvas.innerHTML,oldSvg);
        editor.value=sample;button(d,'Apply edits').onclick();assert.match(status(d).textContent,/Redrawn locally/);assert.equal(calls,1);assert.equal(saves,1);
        let failure=generate(d).onclick();reject(Error('fixture failure'));await failure;
        assert.match(status(d).textContent,/fixture failure/);assert.equal(canvas.innerHTML,oldSvg);assert.equal(generate(d).disabled,false);
        failure=generate(d).onclick();resolve('null');await failure;assert.equal(canvas.innerHTML,oldSvg);assert.equal(saves,1);
        for(const name of ['MESSAGE_EDITED','MESSAGE_SWIPED','CHAT_CHANGED']) {
            d=open();const pending=generate(d).onclick();events.get(name)();resolve(sample);await pending;
            assert.match(status(d).textContent,/discarded/);assert.equal(saves,1);
            if(name==='CHAT_CHANGED')assert.equal(find('ss-dialog'),undefined);
        }
        const before=calls;
        c.chatId=undefined;events.get('CHAT_CHANGED')();assert.equal(action.attributes['aria-disabled'],'true');await action.onclick();assert.equal(calls,before);
        c.chatId='fixture';c.chat=[{mes:'system',is_system:true},{mes:'  '}];events.get('MESSAGE_RECEIVED')();assert.equal(action.attributes['aria-disabled'],'true');
        c.chat=[{name:'A',mes:'Restored scene'}];events.get('CHAT_CHANGED')();assert.equal(action.attributes['aria-disabled'],'false');assert.equal(calls,before,'chat changes never generate');
        // Capture the original excerpt and discard results even if the text is later restored.
        const captured=action.onclick();d=find('ss-dialog');assert.ok(options.prompt.includes('Restored scene'));
        c.chat[0].mes='different';events.get('MESSAGE_EDITED')();c.chat[0].mes='Restored scene';resolve(sample);await captured;assert.equal(saves,1);
        // Native div menu items also support keyboard activation.
        d.close();menu.hidden=false;const dismissalsBeforeKeyboard=menuDismissals;
        action.onkeydown({key:'Enter',preventDefault(){}});assert.equal(menu.hidden,true);assert.equal(menuDismissals,dismissalsBeforeKeyboard+1);assert.equal(calls,before+2);resolve(sample);await new Promise(r=>setImmediate(r));assert.equal(saves,2);
        c.saveMetadata=async()=>{throw Error('save failure');};d=open();failure=generate(d).onclick();resolve(sample);await failure;assert.match(status(d).textContent,/save failure/);assert.equal(generate(d).disabled,false);
        events.get('APP_READY')();assert.equal(all(body).filter(e=>e.id==='ss-sketch').length,1);
        // Version 2 UI: same request includes caption; projection and SVG export are local.
        c.saveMetadata=async()=>{saves++;};
        d=open();const v2=JSON.parse(JSON.stringify(fixtures.C));v2.interpretation='Alex <test> sits against a stone while Sam kneels nearby.';
        const v2Pending=generate(d).onclick();resolve(JSON.stringify(v2));await v2Pending;
        const interpretation=all(d).find(e=>e.className==='ss-interpretation');
        assert.equal(interpretation.children[1].textContent,v2.interpretation);
        assert.equal(interpretation.children[1].innerHTML,undefined,'caption is assigned as text');
        assert.equal(all(d).find(e=>e.className==='ss-assumptions').hidden,false);
        const v2Canvas=all(d).find(e=>e.className==='ss-canvas'),projection=all(d).find(e=>e.tag==='select');
        projection.value='side';projection.onchange();const poseSVG=v2Canvas.innerHTML,requestsBeforeSwitch=calls;
        projection.value='top-down';projection.onchange();assert.notEqual(v2Canvas.innerHTML,poseSVG);assert.equal(calls,requestsBeforeSwitch);
        assert.match(v2Canvas.innerHTML,/Overhead positions/);
        const createObjectURL=URL.createObjectURL;let exported;
        try {URL.createObjectURL=blob=>{exported=blob;return 'blob:mock';};button(d,'Download SVG').onclick();assert.equal(await exported.text(),v2Canvas.innerHTML);}
        finally {URL.createObjectURL=createObjectURL;}
        const lastCaption=interpretation.children[1].textContent,lastDiagram=v2Canvas.innerHTML;
        const oversized=JSON.parse(JSON.stringify(v2));oversized.interpretation='x'.repeat(601);
        const badCaption=generate(d).onclick();resolve(JSON.stringify(oversized));await badCaption;
        assert.match(status(d).textContent,/interpretation exceeds 600/);assert.equal(interpretation.children[1].textContent,lastCaption);assert.equal(v2Canvas.innerHTML,lastDiagram);
        const callsBeforeDiagnostics=calls;
        const diagnosticsPending=generate(d).onclick();resolve(JSON.stringify(spatialFixtures.invalid));await diagnosticsPending;
        assert.equal(calls,callsBeforeDiagnostics+1,'one response supplies props, caption and diagnostics');
        const diagnostics=all(d).find(e=>e.className==='ss-diagnostics');assert.equal(diagnostics.hidden,false);assert.equal(diagnostics.open,undefined);
        assert.ok(all(diagnostics).some(e=>e.textContent?.includes('back-support target')));
        const assumptions=all(d).find(e=>e.className==='ss-assumptions');assert.ok(!all(assumptions).some(e=>/constraint|coordinate|unknown value/.test(e.textContent || '')));
        assert.equal(interpretation.children[1].textContent,spatialFixtures.invalid.interpretation);
        // Notices are about the actual stored scene, not an always-on disclaimer.
        const scenario=regressionScenes.case_spring;
        const restPending=generate(d).onclick();resolve(JSON.stringify(scenario));await restPending;
        projection.value='side';projection.onchange();
        const notice=all(d).filter(e=>e.className==='ss-description').at(-1);
        assert.ok(!notice.textContent.includes('Reaching'));
        const reached=JSON.parse(JSON.stringify(scenario));reached.people[1].arms='reaching';reached.people[1].target='alex';
        const reachPending=generate(d).onclick();resolve(JSON.stringify(reached));await reachPending;assert.ok(notice.textContent.includes('Reaching indicates intent'));
        const cupPending=generate(d).onclick();resolve(JSON.stringify(regressionScenes.case_cupDoor));await cupPending;
        assert.ok(!notice.textContent.includes('Reaching'));const cupSvg=v2Canvas.innerHTML;
        try {URL.createObjectURL=blob=>{exported=blob;return 'blob:mock';};button(d,'Download SVG').onclick();assert.equal(await exported.text(),cupSvg);}
        finally {URL.createObjectURL=createObjectURL;}
        // Complete production UI path with a custom response: generation ->
        // normalization -> metadata -> JSON/SVG export -> saved-panel reload.
        const customResponse=JSON.parse(JSON.stringify(articulatedFixtures.v3_cup));
        const customPending=generate(d).onclick();resolve(JSON.stringify(customResponse));await customPending;
        assert.equal(c.chatMetadata[KEY].scene.schemaVersion,3);
        assert.deepEqual(c.chatMetadata[KEY].scene.people[0].geometry.joints,customResponse.people[0].geometry.joints);
        const savedScene=JSON.parse(JSON.stringify(c.chatMetadata[KEY].scene)),customSvg=v2Canvas.innerHTML;
        try {
            URL.createObjectURL=blob=>{exported=blob;return 'blob:mock';};
            button(d,'Download JSON').onclick();assert.deepEqual(JSON.parse(await exported.text()),savedScene);
            button(d,'Download SVG').onclick();assert.equal(await exported.text(),customSvg);
        } finally {URL.createObjectURL=createObjectURL;}
        const malformed=JSON.parse(JSON.stringify(customResponse));delete malformed.people[0].geometry.joints.leftKnee;
        const badCustom=generate(d).onclick();resolve(JSON.stringify(malformed));await badCustom;
        assert.match(status(d).textContent,/missing leftKnee/);assert.equal(v2Canvas.innerHTML,customSvg);assert.deepEqual(c.chatMetadata[KEY].scene,savedScene);
        const callsBeforeReload=calls;d.close();d=open();
        assert.equal(all(d).find(e=>e.className==='ss-canvas').innerHTML,customSvg);assert.equal(calls,callsBeforeReload);
    } finally { delete globalThis.document;delete globalThis.SillyTavern; }
});
