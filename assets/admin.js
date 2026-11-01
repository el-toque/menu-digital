import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const SUPABASE_URL="https://xdqtaskumrwohqfcuial.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_67zeK-MfnR0yxQmma2v7Xg_AWCZdEPh";
const db=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=s=>document.querySelector(s);
const loginPanel=$("#login-panel"),dashboard=$("#dashboard"),loginMessage=$("#login-message"),dashboardMessage=$("#dashboard-message");
let categories=[],products=[];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function message(el,text,error=false){el.textContent=text;el.classList.toggle("error",error);el.classList.toggle("success",!error&&!!text)}
function money(v,c){return new Intl.NumberFormat("es",{maximumFractionDigits:2}).format(Number(v)||0)+(c?" "+c:"")}
function showLogin(){loginPanel.hidden=false;dashboard.hidden=true}
function showDashboard(user){loginPanel.hidden=true;dashboard.hidden=false;$("#admin-email").textContent=user.email||"Sesión de administrador"}
async function verifyAdmin(){
 const {data:{session}}=await db.auth.getSession();
 if(!session){showLogin();return}
 const {data,error}=await db.rpc("is_menu_admin");
 if(error||data!==true){await db.auth.signOut();showLogin();message(loginMessage,"Esta cuenta no tiene permisos de administrador.",true);return}
 showDashboard(session.user);await loadData();
}
async function loadData(){
 message(dashboardMessage,"Cargando datos…");
 const [c,p]=await Promise.all([db.from("menu_categories").select("*").order("sort_order").order("name"),db.from("menu_products").select("*").order("sort_order").order("name")]);
 if(c.error||p.error){message(dashboardMessage,c.error?.message||p.error?.message,true);return}
 categories=c.data||[];products=p.data||[];renderCategories();renderProducts();message(dashboardMessage,"Cambios guardados directamente en tu menú.");
}
function renderCategories(){
 $("#category-list").innerHTML=categories.map(c=>`<div class="manage-row"><div><strong>${esc(c.name)}</strong><small>${c.is_active?"Visible en el menú":"Desactivada"}</small></div><div class="row-actions"><button data-cat-toggle="${c.id}" class="small-button">${c.is_active?"Desactivar":"Activar"}</button><button data-cat-delete="${c.id}" class="small-button danger">Eliminar</button></div></div>`).join("")||'<p class="muted">Todavía no hay categorías.</p>';
 $("#product-category").innerHTML='<option value="">Sin categoría</option>'+categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
}
function renderProducts(){
 $("#product-count").textContent=products.length+" en total";
 $("#product-list").innerHTML=products.map(p=>{const cat=categories.find(c=>c.id===p.category_id)?.name||"Sin categoría";const state={available:"Disponible",sold_out:"Agotado",hidden:"Oculto"}[p.status];return `<div class="manage-row product-row"><div class="product-summary">${p.image_url?`<img src="${esc(p.image_url)}" alt="">`:'<span class="mini-photo">🍽️</span>'}<div><strong>${esc(p.name)}</strong><small>${esc(cat)} · ${state}</small><b>${money(p.price,p.currency)}</b></div></div><div class="row-actions"><button class="small-button" data-edit="${p.id}">Editar</button><button class="small-button danger" data-delete="${p.id}">Eliminar</button></div></div>`}).join("")||'<p class="muted">Todavía no hay productos. Añade el primero arriba.</p>';
}
$("#login-form").addEventListener("submit",async e=>{e.preventDefault();message(loginMessage,"Verificando acceso…");const {error}=await db.auth.signInWithPassword({email:$("#email").value.trim(),password:$("#password").value});if(error){message(loginMessage,"No se pudo iniciar sesión. Comprueba el correo y la contraseña.",true);return}await verifyAdmin()});
$("#password-form").addEventListener("submit",async e=>{
 e.preventDefault();
 const next=$("#new-password").value,confirm=$("#confirm-password").value;
 if(next.length<8){message($("#password-message"),"Usa al menos 8 caracteres.",true);return}
 if(next!==confirm){message($("#password-message"),"Las contraseñas no coinciden.",true);return}
 message($("#password-message"),"Actualizando contraseña…");
 const {error}=await db.auth.updateUser({password:next});
 if(error){message($("#password-message"),"No se pudo cambiar la contraseña: "+error.message,true);return}
 $("#password-form").reset();
 message($("#password-message"),"Contraseña actualizada correctamente. La próxima vez entra con la nueva contraseña.");
});
$("#logout-button").addEventListener("click",async()=>{await db.auth.signOut();showLogin();message(loginMessage,"Sesión cerrada.")});
$("#category-form").addEventListener("submit",async e=>{e.preventDefault();const name=$("#category-name").value.trim();if(!name)return;const {error}=await db.from("menu_categories").insert({name,sort_order:categories.length});if(error){message(dashboardMessage,error.message,true);return}$("#category-name").value="";await loadData()});
$("#category-list").addEventListener("click",async e=>{const t=e.target.closest("button");if(!t)return;let error;if(t.dataset.catToggle){const c=categories.find(x=>x.id===t.dataset.catToggle);({error}=await db.from("menu_categories").update({is_active:!c.is_active}).eq("id",c.id))}else if(t.dataset.catDelete){const c=categories.find(x=>x.id===t.dataset.catDelete);if(!confirm('¿Eliminar la categoría "'+c.name+'"? Los productos quedarán sin categoría.'))return;({error}=await db.from("menu_categories").delete().eq("id",c.id))}if(error)message(dashboardMessage,error.message,true);else await loadData()});
function resetProduct(){ $("#product-form").reset();$("#product-id").value="";$("#product-form-title").textContent="Añadir producto";$("#product-status").value="available"}
$("#cancel-edit").addEventListener("click",resetProduct);
$("#product-list").addEventListener("click",async e=>{const t=e.target.closest("button");if(!t)return;if(t.dataset.edit){const p=products.find(x=>x.id===t.dataset.edit);$("#product-id").value=p.id;$("#product-name").value=p.name;$("#product-description").value=p.description||"";$("#product-price").value=p.price;$("#product-currency").value=p.currency||"";$("#product-category").value=p.category_id||"";$("#product-image").value=p.image_url||"";$("#product-status").value=p.status;$("#product-form-title").textContent="Editar producto";$("#product-name").focus();window.scrollTo({top:0,behavior:"smooth"})}else if(t.dataset.delete){const p=products.find(x=>x.id===t.dataset.delete);if(!confirm('¿Eliminar "'+p.name+'" definitivamente?'))return;const {error}=await db.from("menu_products").delete().eq("id",p.id);if(error)message(dashboardMessage,error.message,true);else await loadData()}});
$("#product-form").addEventListener("submit",async e=>{e.preventDefault();const id=$("#product-id").value;const item={name:$("#product-name").value.trim(),description:$("#product-description").value.trim(),price:Number($("#product-price").value),currency:$("#product-currency").value.trim(),category_id:$("#product-category").value||null,image_url:$("#product-image").value.trim()||null,status:$("#product-status").value};const q=id?db.from("menu_products").update(item).eq("id",id):db.from("menu_products").insert(item);const {error}=await q;if(error){message(dashboardMessage,error.message,true);return}resetProduct();await loadData()});
db.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT")showLogin()});
verifyAdmin();