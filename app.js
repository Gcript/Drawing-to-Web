// ------------------------------
// Frames (from screenshots)
// ------------------------------
const FRAMES = {
  iphone16:        { label: 'iPhone 16',                 w: 393,  h: 852 },
  iphone16pro:     { label: 'iPhone 16 Pro',             w: 402,  h: 874 },
  iphone16promax:  { label: 'iPhone 16 Pro Max',         w: 440,  h: 956 },
  iphone16plus:    { label: 'iPhone 16 Plus',            w: 430,  h: 932 },
  iphone1415promax:{ label: 'iPhone 14 & 15 Pro Max',    w: 430,  h: 932 },
  iphone1415pro:   { label: 'iPhone 14 & 15 Pro',        w: 393,  h: 852 },
  iphone1314:      { label: 'iPhone 13 & 14',            w: 390,  h: 844 },
  mba:             { label: 'MacBook Air',               w: 1280, h: 832 },
  mbp14:           { label: 'MacBook Pro 14"',           w: 1512, h: 982 },
  mbp16:           { label: 'MacBook Pro 16"',           w: 1728, h: 1117 },
  desktop1440:     { label: 'Desktop',                   w: 1440, h: 1024 }
};
let currentFrameKey = 'iphone16';
let currentFrame = FRAMES[currentFrameKey];

// ------------------------------
// Model
// ------------------------------
const shapes = []; // {id,type:'rect'|'ellipse',x,y,w,h,fill,stroke,strokeW,radius}
let idSeq = 1;

// ------------------------------
// Elements
// ------------------------------
const appRoot    = document.querySelector('.app');
const artboard   = document.getElementById('artboard');
const wrapper    = document.getElementById('artboard-wrap');
const frameSel   = document.getElementById('frameSelect');
const frameInfo  = document.getElementById('frameInfo');

const shapeRows  = document.getElementById('shapeRows');
const clearBtn   = document.getElementById('clearBtn');
const downloadBtn= document.getElementById('downloadBtn');

const shapeType  = document.getElementById('shapeType');
const fillInput  = document.getElementById('fill');
const strokeInput= document.getElementById('stroke');
const strokeWInput=document.getElementById('strokeW');
const radiusInput= document.getElementById('radius');
const radiusRow  = document.getElementById('radiusRow');

const tabs       = Array.from(document.querySelectorAll('.tab'));
const codeOut    = document.getElementById('codeOut');
const copyBtn    = document.getElementById('copyBtn');
const codePane   = document.querySelector('.codepane');
const toggleCodeBtn = document.getElementById('toggleCode');
const closeCodeBtn  = document.getElementById('closeCode');

// ------------------------------
// Code pane toggle
// ------------------------------
function setCodeOpen(open){
  appRoot.classList.toggle('code-open', !!open);
  codePane.setAttribute('aria-hidden', open ? 'false' : 'true');
  toggleCodeBtn.setAttribute('aria-pressed', open ? 'true' : 'false');
}
toggleCodeBtn?.addEventListener('click', ()=> setCodeOpen(!appRoot.classList.contains('code-open')));
closeCodeBtn?.addEventListener('click', ()=> setCodeOpen(false));
window.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') setCodeOpen(false); });

// ------------------------------
// Helpers
// ------------------------------
function getArtboardRect(){ return artboard.getBoundingClientRect(); }
function px(n){ return Math.round(n); }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function updateFrameInfoUI(){
  frameInfo.textContent = `${currentFrame.label}: ${currentFrame.w}×${currentFrame.h}`;
}

// 프레임 적용: aspect-ratio 변경 + 기존 도형 비율 유지 스케일
function applyFrame(key){
  if(!FRAMES[key]) return;
  const oldRect = getArtboardRect();
  currentFrameKey = key;
  currentFrame = FRAMES[key];
  // UI
  frameSel.value = key;
  updateFrameInfoUI();
  // 새 종횡비로 변경
  artboard.style.aspectRatio = `${currentFrame.w} / ${currentFrame.h}`;
  // 레이아웃 반영 후 도형 스케일
  requestAnimationFrame(()=>{
    const nowRect = getArtboardRect();
    const sx = nowRect.width  > 0 && oldRect.width  > 0 ? nowRect.width  / oldRect.width  : 1;
    const sy = nowRect.height > 0 && oldRect.height > 0 ? nowRect.height / oldRect.height : 1;
    if (Number.isFinite(sx) && Number.isFinite(sy)){
      shapes.forEach(s=>{
        s.x = px(s.x * sx); s.y = px(s.y * sy);
        s.w = px(s.w * sx); s.h = px(s.h * sy);
      });
      rerenderAllShapes();
      renderTable();
      renderCode();
    }
  });
}
frameSel.addEventListener('change', e=> applyFrame(e.target.value));

// Hide radius for ellipse (toolbar)
function syncRadiusVisibility(){
  radiusRow.style.display = (shapeType.value === 'rect') ? 'grid' : 'none';
}
syncRadiusVisibility();
shapeType.addEventListener('change', syncRadiusVisibility);

// ------------------------------
// Drawing (Pointer Events)
// ------------------------------
let drawing=false, start={x:0,y:0}, rubber=null, activePointerId=null;

function beginRubber(x,y){
  rubber=document.createElement('div'); rubber.className='rubberband';
  Object.assign(rubber.style,{ left:x+'px', top:y+'px', width:'0px', height:'0px' });
  artboard.appendChild(rubber);
}
function updateRubber(l,t,w,h){
  if(!rubber) return;
  Object.assign(rubber.style,{ left:l+'px', top:t+'px', width:w+'px', height:h+'px' });
}
function endRubber(){ if(rubber){ rubber.remove(); rubber=null; } }

function finishDrawing(cx,cy){
  const r=getArtboardRect();
  const ex=clamp(cx - r.left,0,r.width), ey=clamp(cy - r.top,0,r.height);
  const left=Math.min(start.x,ex), top=Math.min(start.y,ey);
  const w=Math.abs(ex-start.x), h=Math.abs(ey-start.y);
  endRubber(); if(w<2||h<2) return;
  const model={ id:idSeq++, type:shapeType.value, x:px(left), y:px(top), w:px(w), h:px(h),
    fill:fillInput.value, stroke:strokeInput.value, strokeW:Number(strokeWInput.value)||0,
    radius: shapeType.value==='ellipse' ? 9999 : (Number(radiusInput.value)||0) };
  shapes.push(model); renderShape(model); renderTable(); renderCode();
}

artboard.addEventListener('pointerdown', e=>{
  if(e.pointerType==='mouse' && e.button!==0) return;
  const r=getArtboardRect();
  start={ x:clamp(e.clientX-r.left,0,r.width), y:clamp(e.clientY-r.top,0,r.height) };
  drawing=true; activePointerId=e.pointerId; artboard.setPointerCapture(activePointerId);
  beginRubber(start.x,start.y); e.preventDefault();
},{passive:false});

artboard.addEventListener('pointermove', e=>{
  if(!drawing || e.pointerId!==activePointerId) return;
  const r=getArtboardRect();
  let cx=clamp(e.clientX-r.left,0,r.width), cy=clamp(e.clientY-r.top,0,r.height);
  if(e.pointerType==='mouse' && e.shiftKey){
    const dx=cx-start.x, dy=cy-start.y, size=Math.min(Math.abs(dx),Math.abs(dy));
    cx=start.x+Math.sign(dx||1)*size; cy=start.y+Math.sign(dy||1)*size;
  }
  const l=Math.min(start.x,cx), t=Math.min(start.y,cy), w=Math.abs(cx-start.x), h=Math.abs(cy-start.y);
  updateRubber(l,t,w,h); e.preventDefault();
},{passive:false});

function endPointer(e){
  if(!drawing || e.pointerId!==activePointerId) return;
  drawing=false; artboard.releasePointerCapture(activePointerId);
  finishDrawing(e.clientX,e.clientY); activePointerId=null; e.preventDefault();
}
artboard.addEventListener('pointerup', endPointer, {passive:false});
artboard.addEventListener('pointercancel', endPointer, {passive:false});

// ------------------------------
// Renderers
// ------------------------------
function renderShape(m){
  const el=document.createElement('div'); el.className='shape';
  Object.assign(el.style,{
    left:m.x+'px', top:m.y+'px', width:m.w+'px', height:m.h+'px',
    background:m.fill, border:m.strokeW+'px solid '+m.stroke,
    borderRadius: (m.type==='ellipse') ? '9999px' : (m.radius+'px')
  });
  artboard.appendChild(el);
}
function rerenderAllShapes(){
  artboard.querySelectorAll('.shape').forEach(n=>n.remove());
  shapes.forEach(renderShape);
}

// ------------------------------
// Table (summary + actions)
// ------------------------------
function renderTable(){
  shapeRows.innerHTML = shapes.map(s=>{
    const fillSw = `<span class="swatch" style="background:${s.fill}"></span>`;
    const strkSw = `<span class="swatch" style="background:${s.stroke}"></span>`;
    return `<tr data-id="${s.id}">
      <td>${s.id}</td><td>${s.type}</td><td>${s.x}</td><td>${s.y}</td>
      <td>${s.w}</td><td>${s.h}</td><td>${fillSw}${s.fill}</td>
      <td>${strkSw}${s.stroke}</td><td>${s.strokeW}</td><td>${s.type==='ellipse'?'—':s.radius}</td>
      <td class="actions"><button class="btn-row edit">속성 변경</button><button class="btn-row del">삭제</button></td>
    </tr>`;
  }).join('');
}
function constrainShape(s){
  const r=getArtboardRect();
  const maxW=Math.max(1,Math.round(r.width)), maxH=Math.max(1,Math.round(r.height));
  s.w=Math.min(Math.max(1,s.w|0),maxW); s.h=Math.min(Math.max(1,s.h|0),maxH);
  s.x=clamp(s.x|0,0,Math.round(r.width-s.w)); s.y=clamp(s.y|0,0,Math.round(r.height-s.h));
  if(s.type==='ellipse') s.radius=9999;
}

// ------------------------------
// Modal editor (same features as 이전 버전)
// ------------------------------
const modal=document.getElementById('editorModal');
const modalClose=document.getElementById('editorClose');
const modalCancel=document.getElementById('editorCancel');
const modalApply=document.getElementById('editorApply');
const modalBackdrop=modal.querySelector('.modal-backdrop');

const ed_type=document.getElementById('ed_type');
const ed_x=document.getElementById('ed_x');
const ed_y=document.getElementById('ed_y');
const ed_w=document.getElementById('ed_w');
const ed_h=document.getElementById('ed_h');
const ed_fill=document.getElementById('ed_fill');
const ed_stroke=document.getElementById('ed_stroke');
const ed_sw=document.getElementById('ed_sw');
const ed_sw_num=document.getElementById('ed_sw_num');
const ed_radius=document.getElementById('ed_radius');
const ed_radius_num=document.getElementById('ed_radius_num');
const previewShape=document.getElementById('previewShape');

let editingId=null;
function openEditor(id){
  const s=shapes.find(x=>x.id===id); if(!s) return; editingId=id;
  ed_type.value=s.type; ed_x.value=s.x; ed_y.value=s.y; ed_w.value=s.w; ed_h.value=s.h;
  ed_fill.value=s.fill; ed_stroke.value=s.stroke; ed_sw.value=s.strokeW; ed_sw_num.value=s.strokeW;
  const rv=s.type==='ellipse'?0:(s.radius||0); ed_radius.value=rv; ed_radius_num.value=rv;
  toggleRadiusDisabled(s.type==='ellipse'); updatePreview();
  modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false'); ed_x.focus();
}
function closeEditor(){ modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); editingId=null; }
function toggleRadiusDisabled(disabled){ ed_radius.disabled=disabled; ed_radius_num.disabled=disabled; }
function updatePreview(){
  const t=ed_type.value, w=Math.max(1,Number(ed_w.value)||120), h=Math.max(1,Number(ed_h.value)||80);
  const sw=Math.max(0,Number(ed_sw.value)||0), r=Math.max(0,Number(ed_radius.value)||0);
  Object.assign(previewShape.style,{
    width:w/3+'px', height:h/3+'px', background:ed_fill.value||'#60a5fa',
    border:sw+'px solid '+(ed_stroke.value||'#1f2937'),
    borderRadius:(t==='ellipse')?'9999px':(r+'px')
  });
}
[[ed_sw,ed_sw_num],[ed_radius,ed_radius_num]].forEach(([a,b])=>{
  a.addEventListener('input',()=>{ b.value=a.value; updatePreview(); });
  b.addEventListener('input',()=>{ a.value=b.value; updatePreview(); });
});
[ed_type,ed_w,ed_h,ed_fill,ed_stroke].forEach(el=>{
  el.addEventListener('input',()=>{ if(el===ed_type) toggleRadiusDisabled(ed_type.value==='ellipse'); updatePreview(); });
});
modalApply.addEventListener('click',()=>{
  if(editingId==null) return; const s=shapes.find(x=>x.id===editingId); if(!s) return;
  s.type=ed_type.value; s.x=Number(ed_x.value)||0; s.y=Number(ed_y.value)||0;
  s.w=Number(ed_w.value)||1; s.h=Number(ed_h.value)||1; s.fill=ed_fill.value||s.fill;
  s.stroke=ed_stroke.value||s.stroke; s.strokeW=Math.max(0,Number(ed_sw.value)||0);
  s.radius=(s.type==='ellipse')?9999:Math.max(0,Number(ed_radius.value)||0);
  constrainShape(s); rerenderAllShapes(); renderTable(); renderCode(); closeEditor();
});
[modalClose,modalCancel,modalBackdrop].forEach(btn=>{
  btn.addEventListener('click',e=>{ if(e.target.dataset.close || btn===modalClose || btn===modalCancel) closeEditor(); });
});
window.addEventListener('keydown',e=>{ if(e.key==='Escape' && !modal.classList.contains('hidden')) closeEditor(); });

shapeRows.addEventListener('click',e=>{
  const tr=e.target.closest('tr'); if(!tr) return; const id=Number(tr.dataset.id);
  if(e.target.closest('.del')){ const idx=shapes.findIndex(x=>x.id===id); if(idx>=0){ shapes.splice(idx,1); rerenderAllShapes(); renderTable(); renderCode(); } }
  else if(e.target.closest('.edit')) openEditor(id);
});

// ------------------------------
// Code generation (uses currentFrame.w/h)
// ------------------------------
function generateSplitFiles(){
  const fw=currentFrame?.w || 960, fh=currentFrame?.h || 540;
  const css = `/* --- Generated CSS --- */
#artboard{position:relative;width:${fw}px;height:${fh}px;background:#fff;overflow:hidden;}
.shape{position:absolute;box-sizing:border-box;}
` + shapes.map(s=>`.shape-${s.id}{left:${s.x}px;top:${s.y}px;width:${s.w}px;height:${s.h}px;background:${s.fill};border:${s.strokeW}px solid ${s.stroke};border-radius:${s.type==='ellipse'?'9999px':s.radius+'px'};}`).join('\n');

  const html = `<!-- --- Generated HTML --- -->
<div id="artboard">
${shapes.map(s=>`  <div class="shape shape-${s.id}"></div>`).join('\n')}
</div>`;

  const js = `// --- Generated JS ---
// 정적 HTML/CSS만으로도 충분합니다. 동적 생성을 원하면 아래 예시를 사용하세요.
/*
const data = ${JSON.stringify(shapes, null, 2)};
const mount = document.getElementById('artboard');
for(const s of data){
  const el=document.createElement('div'); el.className='shape';
  Object.assign(el.style,{
    position:'absolute', left:s.x+'px', top:s.y+'px', width:s.w+'px', height:s.h+'px',
    background:s.fill, border:s.strokeW+'px solid '+s.stroke,
    borderRadius:(s.type==='ellipse'?'9999px':s.radius+'px'), boxSizing:'border-box'
  });
  mount.appendChild(el);
}
*/`;

  return { html, css, js };
}
function generateSingleFile(){
  const {html, css, js} = generateSplitFiles();
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Exported Shapes</title>
  <style>
    body{margin:0;display:grid;place-content:center;min-height:100vh;background:#0f172a;color:#e2e8f0;font-family:system-ui,Segoe UI,Roboto,Apple SD Gothic Neo,Malgun Gothic,sans-serif;}
    #frame{background:#111827;border:1px solid #1f2937;border-radius:12px;padding:16px;max-width:980px;box-shadow:0 10px 30px rgba(0,0,0,.4);}
    h1{font-size:16px;margin:0 0 10px 0;}
    .hint{font-size:12px;color:#94a3b8;margin-bottom:12px;}
    ${css}
  </style>
</head>
<body>
  <div id="frame">
    <h1>Exported Shapes</h1>
    <div class="hint">이 파일은 도형을 정적 HTML/CSS로만 표시합니다.</div>
${html.split('\n').map(l=>'    '+l).join('\n')}
  </div>
  <script>
${js.split('\n').map(l=>'    '+l).join('\n')}
  <\/script>
</body>
</html>`;
}
function renderCode(){
  const active=document.querySelector('.tab.active')?.dataset.tab || 'single';
  const {html, css, js}=generateSplitFiles();
  codeOut.textContent = active==='single' ? generateSingleFile()
                      : active==='html'   ? html
                      : active==='css'    ? css
                      : js;
}
tabs.forEach(t=>t.addEventListener('click',()=>{
  tabs.forEach(x=>x.classList.toggle('active', x===t)); renderCode();
}));
copyBtn.addEventListener('click', async ()=>{
  try{ await navigator.clipboard.writeText(codeOut.textContent||''); copyBtn.textContent='복사됨!'; setTimeout(()=>copyBtn.textContent='코드 복사',1200); }
  catch(err){ alert('복사 실패: '+err); }
});
clearBtn.addEventListener('click', ()=>{
  shapes.splice(0,shapes.length); rerenderAllShapes(); renderTable(); renderCode();
});
downloadBtn.addEventListener('click', ()=>{
  const content=generateSingleFile(); const blob=new Blob([content],{type:'text/html'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='index.html';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

// ------------------------------
// init
// ------------------------------
function initialSetup(){
  // set default frame + UI sync
  applyFrame(currentFrameKey);
  renderTable();
  renderCode();
}
initialSetup();
