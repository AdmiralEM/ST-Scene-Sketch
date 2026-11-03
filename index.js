import { parseScene, renderSVG, buildPrompt } from './scene.js';
const KEY = 'bluewaters_scene_sketch';
let busy = false;
const ctx = () => SillyTavern.getContext();
function element(tag, text, parent) { const e=document.createElement(tag); if(text)e.textContent=text; parent?.append(e); return e; }
function download(text, name, type) { const url=URL.createObjectURL(new Blob([text],{type})); const a=element('a'); a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function openPanel() {
    document.querySelector('#ss-dialog')?.remove();
    const dialog=element('dialog',null,document.body); dialog.id='ss-dialog';
    const panel=element('div',null,dialog);panel.className='ss-panel';
    element('h3','Scene Sketch',panel);
    element('p','Manual scene blocking · one request per Generate · uses your current model. Stick figures show positioning without graphic anatomy.',panel);
    const controls=element('div',null,panel);controls.className='ss-row';
    const label=element('label','Recent messages: ',controls);
    const count=element('input',null,label);count.type='number';count.min='1';count.max='12';count.value=ctx().extensionSettings[KEY]?.count || 4;
    const view=element('select',null,controls);['side','top-down'].forEach(s=>{const o=element('option',s,view);o.value=s;});
    const generate=element('button','Generate',controls);generate.className='menu_button';
    const close=element('button','Close',controls);close.className='menu_button';close.onclick=()=>dialog.close();
    const status=element('div','Ready. Source text is capped at 12,000 characters.',panel);status.className='ss-status';status.setAttribute('role','status');
    const canvas=element('div',null,panel);
    const details=element('div',null,panel);
    const edit=element('details',null,panel);element('summary','Edit scene JSON (free local redraw)',edit);
    const input=element('textarea',null,edit);input.setAttribute('aria-label','Scene JSON');
    const redraw=element('button','Apply edits',edit);redraw.className='menu_button';
    const exports=element('div',null,panel);exports.className='ss-row';
    const svgButton=element('button','Download SVG',exports),jsonButton=element('button','Download JSON',exports);
    svgButton.className=jsonButton.className='menu_button';svgButton.disabled=jsonButton.disabled=true;
    let scene;
    function show(data) {
        scene=data;input.value=JSON.stringify(data,null,2);
        // Only the deterministic renderer creates markup; model HTML is never inserted.
        canvas.innerHTML=renderSVG(data);
        details.replaceChildren();element('p',data.notes || 'No assumptions reported by the model.',details);
        for(const p of data.people)element('p',`${p.name}: ${p.action} · facing ${p.facing}`,details);
        svgButton.disabled=jsonButton.disabled=false;
    }
    redraw.onclick=()=>{try{show(parseScene(input.value));status.textContent='Redrawn locally. No request sent.';}catch(e){status.textContent=e.message;}};
    svgButton.onclick=()=>download(renderSVG(scene),'scene-sketch.svg','image/svg+xml');
    jsonButton.onclick=()=>download(JSON.stringify(scene,null,2),'scene-sketch.json','application/json');
    generate.onclick=async()=>{
        if(busy){status.textContent='Another scene request is still running.';return;}
        const context=ctx(), chat=context.chat, metadata=context.chatMetadata;
        const n=Math.max(1,Math.min(12,Number(count.value)||4));count.value=n;
        const messages=chat.filter(m=>!m.is_system && typeof m.mes==='string').slice(-n);
        if(!messages.length){status.textContent='Open a chat with at least one message first.';return;}
        const source=JSON.stringify(messages.map(m=>({name:m.name,text:m.mes}))).slice(-12000);
        const fingerprint=JSON.stringify(chat.map(m=>[m.name,m.mes,m.swipe_id]));
        context.extensionSettings[KEY]={count:n};context.saveSettingsDebounced();
        busy=true;generate.disabled=true;status.textContent='Generating scene…';
        try {
            if(typeof context.generateRaw!=='function')throw Error('This SillyTavern build does not expose generateRaw. Update SillyTavern.');
            const raw=await context.generateRaw({prompt:buildPrompt(source,view.value),responseLength:1800});
            const result=parseScene(raw);
            const current=ctx();
            if(current.chat!==chat || current.chatMetadata!==metadata || JSON.stringify(current.chat.map(m=>[m.name,m.mes,m.swipe_id]))!==fingerprint){status.textContent='Chat changed during generation. Result discarded; generate again for the current scene.';return;}
            show(result);
            current.chatMetadata[KEY]={source,scene:result};await current.saveMetadata();
            status.textContent='Scene ready. Approximate blocking; verify ambiguous poses against the text.';
        }catch(e){status.textContent=`Could not generate: ${e.message}. No automatic retry was sent.`;}
        finally{busy=false;generate.disabled=false;}
    };
    const cached=ctx().chatMetadata?.[KEY];
    if(cached?.scene){try{show(parseScene(JSON.stringify(cached.scene)));status.textContent='Saved sketch — may be older than the current scene. Generate to update.';}catch{/* Ignore invalid saved data. */}}
    dialog.showModal();
}
function init(){
    if(document.querySelector('#ss-open'))return;
    const host=document.querySelector('#extensions_settings2') || document.querySelector('#extensions_settings');
    if(!host)return;
    const button=element('button','Scene Sketch · Open',host);button.id='ss-open';button.className='menu_button';button.onclick=openPanel;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
const context=ctx();if(context.eventSource && context.eventTypes?.APP_READY)context.eventSource.on(context.eventTypes.APP_READY,init);
