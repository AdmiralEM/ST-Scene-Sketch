import { parseScene, renderSVG, buildPrompt, layoutScene } from './scene.js';
import { KEY, messageCount, buildExcerpt, captureChat, isCurrentChat } from './runtime.js';
import { sceneNotice } from './layout.js';
let busy = false;
let revision = 0;
let activePanel;
const ctx = () => SillyTavern.getContext();
const defaultView = value => value === 'top-down' ? value : 'side';
const defaults = () => ({ count: messageCount(ctx().extensionSettings[KEY]?.count), view: defaultView(ctx().extensionSettings[KEY]?.view) });
const usableChat = () => {
    const c = ctx();
    return c.chatId != null && c.chatId !== '' && c.chat?.some(m => !m.is_system && typeof m.mes === 'string' && m.mes.trim());
};
function element(tag, text, parent) { const e=document.createElement(tag); if(text)e.textContent=text; parent?.append(e); return e; }
function button(text, parent) { const e=element('button',text,parent);e.type='button';e.className='menu_button';return e; }
function download(text, name, type) { const url=URL.createObjectURL(new Blob([text],{type})); const a=element('a'); a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function countControl(parent, value, title) {
    const label=element('label',null,parent);label.className='ss-field';element('span',title,label);
    const input=element('input',null,label);input.type='number';input.min='1';input.max='12';input.step='1';input.value=value;input.className='text_pole ss-count';
    return input;
}
function viewControl(parent, value, title) {
    const label=element('label',null,parent);label.className='ss-field';element('span',title,label);
    const select=element('select',null,label);select.className='text_pole';
    for(const [value,text] of [['side','Pose view (side)'],['top-down','Overhead layout (positions)']]){const o=element('option',text,select);o.value=value;}
    select.value=value;return select;
}
function refresh() {
    const disabled=busy || !usableChat();
    const action=document.querySelector('#ss-sketch');
    if(action){action.disabled=disabled;action.setAttribute('aria-disabled',String(disabled));action.setAttribute('aria-busy',String(busy));action.tabIndex=disabled?-1:0;}
    const icon=document.querySelector('#ss-action-icon');
    if(icon)icon.className=`fa-solid ${busy?'fa-spinner fa-spin':'fa-person'} extensionsMenuExtensionButton`;
    if(activePanel){
        const {generate,count,view,redraw,dialog,hasScene}=activePanel;
        generate.disabled=disabled;generate.textContent=busy?'Generating…':hasScene?'Regenerate':'Generate';
        count.disabled=view.disabled=redraw.disabled=busy;
        dialog.setAttribute('aria-busy',String(busy));
        if(!busy && activePanel.waiting){activePanel.waiting=false;activePanel.report('The other request finished. Reopen the panel to load its saved sketch, or regenerate.');}
    }
}
function prepareRequest(count,view) {
    const context=ctx();
    return {snapshot:captureChat(context,revision),source:buildExcerpt(context.chat,count),view:defaultView(view)};
}
function openPanel(request) {
    const previous=document.querySelector('#ss-dialog');previous?.close();previous?.remove();
    const dialog=element('dialog',null,document.body);dialog.id='ss-dialog';dialog.setAttribute('aria-labelledby','ss-title');
    const panel=element('div',null,dialog);panel.className='ss-panel';
    const header=element('div',null,panel);header.className='ss-heading';
    const heading=element('h3','Scene Sketch',header);heading.id='ss-title';
    const close=button('Close',header);close.onclick=()=>dialog.close();
    element('p','Scene blocking using your current text model. One request per generation.',panel).className='ss-description';
    const controls=element('div',null,panel);controls.className='ss-row';
    const settings=defaults();
    const count=countControl(controls,settings.count,'Recent messages');
    const view=viewControl(controls,settings.view,'View');
    const generate=button('Generate',controls);generate.className+=' ss-primary';
    const status=element('div','Ready. Source text is capped at 12,000 characters.',panel);status.className='ss-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const canvas=element('div',null,panel);canvas.className='ss-canvas';
    element('p','Your scene diagram will appear here.',canvas);
    const caption=element('section',null,panel);caption.className='ss-interpretation';caption.setAttribute('aria-label','Scene interpretation');
    element('h4','Scene interpretation',caption);
    const interpretation=element('p','Generate a sketch to see the model’s interpretation of the final moment.',caption);
    const viewNote=element('p',null,panel);viewNote.className='ss-description';
    const assumptions=element('details',null,panel);assumptions.className='ss-assumptions';assumptions.hidden=true;
    element('summary','Scene assumptions',assumptions);
    const assumptionList=element('div',null,assumptions);
    const details=element('div',null,panel);details.className='ss-descriptions';
    const exports=element('div',null,panel);exports.className='ss-row ss-exports';exports.setAttribute('aria-label','Export sketch');
    const svgButton=button('Download SVG',exports),jsonButton=button('Download JSON',exports);svgButton.disabled=jsonButton.disabled=true;
    const diagnostics=element('details',null,panel);diagnostics.className='ss-diagnostics';diagnostics.hidden=true;
    element('summary','Advanced · Layout diagnostics',diagnostics);
    const diagnosticList=element('div',null,diagnostics);
    const edit=element('details',null,panel);edit.className='ss-advanced';element('summary','Advanced · Edit scene JSON',edit);
    element('p','Apply edits redraws locally without a model request. Export JSON to keep manual edits.',edit);
    const input=element('textarea',null,edit);input.className='text_pole';input.setAttribute('aria-label','Scene JSON');
    const redraw=button('Apply edits',edit);
    let scene;
    const state={dialog,generate,count,view,redraw,hasScene:false};activePanel=state;
    dialog.addEventListener('close',()=>{if(activePanel===state)activePanel=undefined;dialog.remove();},{once:true});
    function report(text,kind='ready') {status.textContent=text;status.setAttribute('data-state',kind);}
    state.report=report;
    function show(data) {
        scene=data;state.hasScene=true;input.value=JSON.stringify(data,null,2);
        // Only the deterministic renderer creates markup; model HTML is never inserted.
        canvas.innerHTML=renderSVG(data,view.value);
        interpretation.textContent=data.interpretation || 'This older coordinate-based sketch has no stored scene interpretation.';
        const layout=layoutScene(data,view.value);
        viewNote.textContent=sceneNotice(layout);
        assumptionList.replaceChildren();assumptions.hidden=!layout.assumptions.length;
        for(const note of layout.assumptions)element('p',note,assumptionList);
        diagnosticList.replaceChildren();diagnostics.hidden=!layout.diagnostics.length;
        for(const message of layout.diagnostics)element('p',message,diagnosticList);
        details.replaceChildren();
        for(const p of layout.people)element('p',`${p.name}: ${p.action} · facing ${p.facing}`,details);
        svgButton.disabled=jsonButton.disabled=false;refresh();
    }
    redraw.onclick=()=>{if(busy)return;try{show(parseScene(input.value));report('Redrawn locally. No request sent.');}catch(e){report(e.message,'error');}};
    view.onchange=()=>{if(scene)show(scene);};
    svgButton.onclick=()=>download(renderSVG(scene,view.value),'scene-sketch.svg','image/svg+xml');
    jsonButton.onclick=()=>download(JSON.stringify(scene,null,2),'scene-sketch.json','application/json');
    async function run(prepared) {
        if(busy)return;
        busy=true;refresh();report('Generating scene… Your previous sketch stays available.','loading');
        try {
            const intended=prepared || prepareRequest(messageCount(count.value),view.value);
            count.value=messageCount(count.value);
            const context=ctx();
            if(!isCurrentChat(intended.snapshot,context,revision))throw Error('Chat changed before generation. Open the current scene again.');
            if(typeof context.generateRaw!=='function')throw Error('This SillyTavern build does not expose generateRaw. Update SillyTavern.');
            if(typeof context.saveMetadata!=='function' || !context.chatMetadata)throw Error('Chat metadata API unavailable.');
            const raw=await context.generateRaw({prompt:buildPrompt(intended.source,intended.view),responseLength:1800,trimNames:false});
            const result=parseScene(raw), current=ctx();
            if(!isCurrentChat(intended.snapshot,current,revision)){report('Chat changed during generation. Result discarded; generate again for the current scene.','error');return;}
            show(result);
            current.chatMetadata[KEY]={source:intended.source,scene:result,view:view.value};await current.saveMetadata();
            report('Scene ready; chat save requested. Approximate blocking; verify ambiguous poses against the text.');
        }catch(e){report(`Could not generate or save: ${e?.message || String(e)}. No automatic retry was sent.`,'error');}
        finally{busy=false;refresh();}
    }
    generate.onclick=()=>run();
    const cached=ctx().chatMetadata?.[KEY];
    if(!request && cached?.view)view.value=defaultView(cached.view);
    if(cached?.scene){try{show(parseScene(JSON.stringify(cached.scene)));report('Saved sketch — may be older than the current scene. Regenerate to update.');}catch{/* Ignore invalid saved data. */}}
    if(busy){state.waiting=true;report('Another Scene Sketch request is running. Please wait before generating again.','loading');}
    dialog.showModal();refresh();
    if(request)return run(request);
}
function sketchCurrentScene() {
    if(busy || !usableChat())return;
    const settings=defaults();
    // Snapshot before opening the panel, with no asynchronous gap.
    const request=prepareRequest(settings.count,settings.view);
    // Core owns the menu's private visibility flag. Use its html outside-click
    // handler instead of hiding #extensionsMenu and leaving that flag stale.
    // This also dismisses the menu for keyboard activation, before showModal().
    document.documentElement.click();
    return openPanel(request);
}
function init(){
    const host=document.querySelector('#extensions_settings2') || document.querySelector('#extensions_settings');
    if(host && !document.querySelector('#ss-settings')){
        const root=element('div',null,host);root.id='ss-settings';
        const drawer=element('div',null,root);drawer.className='inline-drawer';
        const toggle=element('div',null,drawer);toggle.className='inline-drawer-toggle inline-drawer-header';toggle.tabIndex=0;toggle.setAttribute('role','button');toggle.setAttribute('aria-label','Scene Sketch settings');
        element('b','Scene Sketch',toggle);element('div',null,toggle).className='inline-drawer-icon fa-solid fa-circle-chevron-down down';
        // Core handles clicks on inline-drawer-toggle, including the slide animation.
        toggle.onkeydown=e=>{if(e.key==='Enter' || e.key===' '){e.preventDefault();toggle.click();}};
        const content=element('div',null,drawer);content.className='inline-drawer-content';
        element('p','Sketch the latest scene as a simple pose diagram using your current text model.',content);
        const settings=defaults();
        const count=countControl(content,settings.count,'Default recent messages (1–12)');count.id='ss-default-count';
        const view=viewControl(content,settings.view,'Default view');view.id='ss-default-view';
        const save=()=>{const c=ctx();count.value=messageCount(count.value);view.value=defaultView(view.value);c.extensionSettings[KEY]={...c.extensionSettings[KEY],count:Number(count.value),view:view.value};c.saveSettingsDebounced();};
        count.onchange=view.onchange=save;
        const open=button('Open Scene Sketch',content);open.id='ss-open';open.onclick=()=>openPanel();
    }
    const menu=document.querySelector('#extensionsMenu');
    if(menu && !document.querySelector('#ss-sketch')){
        const container=element('div',null,menu);container.className='extension_container';container.id='ss-wand-container';
        const action=element('div',null,container);action.id='ss-sketch';action.className='list-group-item flex-container flexGap5';action.title='Sketch Current Scene';action.setAttribute('role','button');action.setAttribute('aria-label','Sketch Current Scene');
        const icon=element('div',null,action);icon.id='ss-action-icon';icon.setAttribute('aria-hidden','true');element('span','Sketch Current Scene',action);
        action.onclick=sketchCurrentScene;
        action.onkeydown=e=>{if(e.key==='Enter' || e.key===' '){e.preventDefault();sketchCurrentScene();}};
    }
    refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
const context=ctx();
for(const name of ['APP_INITIALIZED','APP_READY'])if(context.eventTypes?.[name])context.eventSource?.on(context.eventTypes[name],init);
// The chat array is reused by ST. Events also catch changes that are later undone.
for (const name of ['CHAT_CHANGED','CHAT_LOADED','MESSAGE_EDITED','MESSAGE_SWIPED','MESSAGE_DELETED','MESSAGE_UPDATED','MESSAGE_SENT','MESSAGE_RECEIVED','MESSAGE_SWIPE_DELETED']) {
    const event=context.eventTypes?.[name];
    if(event)context.eventSource?.on(event,()=>{
        revision++;
        if(name==='CHAT_CHANGED' || name==='CHAT_LOADED')document.querySelector('#ss-dialog')?.close();
        refresh();
    });
}
