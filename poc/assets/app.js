const NAV=[["index.html","Login / SSO"],["dashboard.html","Dashboard"],["planning.html","Audit Planning"],["execution.html","Audit Execution"],["compliance.html","Compliance Tracking"],["reports.html","Reports & Documents"],["mobile.html","Mobile Field App"],["traceability.html","SRS Traceability"]];
const ROLES={admin:"System Administrator",director:"Audit Director",chief:"Chief Audit Officer",senior:"Senior Audit Officer",junior:"Junior Audit Officer",coord:"Department Coordinator"};
// Illustrative permission matrix (actual permissions are TO CONFIRM in SRS 3.1)
const CAN={admin:["users","config","integrations"],director:["policy","approve-report","view-all"],chief:["plan","assign","approve-review","approve-report"],senior:["execute","finding","review-submit"],junior:["collect","workpaper"],coord:["respond","upload-dept"]};
function role(){return localStorage.getItem("role")||"chief"}
function can(a){return (CAN[role()]||[]).includes(a)}
function toast(m){let t=document.getElementById("toast");t.textContent=m;t.style.display="block";setTimeout(()=>t.style.display="none",2600)}
function tab(btn,id){const p=btn.closest(".card,.main");p.querySelectorAll(":scope>.tabs>button").forEach(b=>b.classList.remove("on"));btn.classList.add("on");p.querySelectorAll(":scope>.tab").forEach(t=>t.classList.toggle("on",t.id==id))}
function layout(){
 const cur=location.pathname.split("/").pop()||"index.html";
 document.body.insertAdjacentHTML("afterbegin",`<div class="side"><h1>Audit Management System<small>Govt. of Uttar Pradesh • PoC</small></h1>${NAV.map(n=>`<a href="${n[0]}" class="${n[0]==cur?"on":""}">${n[1]}</a>`).join("")}</div>
 <div class="top"><span><b>Centralized Audit Management Platform</b> &nbsp;<span class="b warn">PoC – dummy data</span></span>
 <span>Viewing as: <select id="rs" style="width:auto" onchange="localStorage.setItem('role',this.value);location.reload()">${Object.entries(ROLES).map(([k,v])=>`<option value="${k}" ${k==role()?"selected":""}>${v}</option>`).join("")}</select></span></div><div id="toast" class="toast"></div>`);
 document.querySelectorAll("[data-need]").forEach(e=>{if(!can(e.dataset.need)){e.disabled=true;e.title="Not permitted for "+ROLES[role()]+" (illustrative)";e.style.opacity=.4}});
}
document.addEventListener("DOMContentLoaded",layout);