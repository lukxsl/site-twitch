/* ============================================================
   UTILS — DOM
   ============================================================ */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const n1 = n => Number(n).toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1});