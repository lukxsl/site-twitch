// =========================================
// ESTADO GLOBAL & CONFIG
// =========================================
const STATE = {
    user: null,
    jogos: [],
    filmes: [],
    votos: [],
    config: {},
    currentTab: 'inicio'
};

const API = {
    twitch: '/api/twitch',
    tierlist: '/api/tierlist',
    votos: '/api/votos',
    config: '/api/config',
    auth: '/api/auth',
    admin: '/api/admin'
};

// =========================================
// HELPERS
// =========================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const esc = (str) => String(str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function toast(msg, type = 'success') {
    let container = $('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

function showSkeleton(targetId, lines = 3) {
    const el = document.getElementById(targetId);
    if(!el) return;
    el.innerHTML = Array(lines).fill('<div class="skeleton" style="height: 40px; margin-bottom: 12px;"></div>').join('');
}

// =========================================
// NAVEGAÇÃO (SPA)
// =========================================
function mudarAba(aba) {
    STATE.currentTab = aba;
    $$('.page-section').forEach(s => s.classList.remove('ativo'));
    $$('.nav-btn').forEach(b => b.classList.toggle('on', b.dataset.aba === aba));
    
    const sec = $(`#sec-${aba}`);
    if (sec) {
        sec.classList.add('ativo');
        if (aba === 'admin' && STATE.user?.admin) renderAdmin();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =========================================
// AUTH & USER
// =========================================
async function checkAuth() {
    try {
        const res = await fetch(`${API.auth}?action=me`);
        const data = await res.json();
        STATE.user = data.logado ? data : null;
        renderAuthUI();
        if (STATE.user?.admin) {
            $('.nav-admin-link').style.display = 'block';
        }
    } catch (e) { console.error('Auth error', e); }
}

function renderAuthUI() {
    const authEl = $('#navAuth');
    if (STATE.user) {
        authEl.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;">
                <img src="${esc(STATE.user.avatar)}" style="width:32px;height:32px;border-radius:50%;border:2px solid var(--accent);">
                <span style="font-size:0.875rem;font-weight:600;">${esc(STATE.user.username)}</span>
                <button class="btn btn-ghost" style="padding:6px 12px;font-size:0.75rem;" onclick="logout()">Sair</button>
            </div>
        `;
    } else {
        authEl.innerHTML = `<a href="${API.auth}?action=login" class="btn-discord">Entrar com Discord</a>`;
    }
}

async function logout() {
    await fetch(`${API.auth}?action=logout`);
    STATE.user = null;
    renderAuthUI();
    location.reload();
}

// =========================================
// RENDER INÍCIO (Exemplo de Nova UI)
// =========================================
async function renderInicio() {
    const sec = $('#sec-inicio');
    sec.innerHTML = `
        <div class="card" style="text-align:center; padding: 60px 20px; background: linear-gradient(180deg, var(--accent-soft) 0%, transparent 100%);">
            <h1 style="font-size: 2.5rem; margin-bottom: 16px;">Bem-vindo ao Cantinho 💜</h1>
            <p style="color:var(--text-secondary); max-width: 600px; margin: 0 auto 24px;">
                Acompanhe a Tier List, vote no próximo jogo e faça parte da comunidade.
            </p>
            <div style="display:flex;gap:12px;justify-content:center;">
                <button class="btn btn-primary" onclick="mudarAba('tierlist')">Ver Tier List</button>
                <a href="https://twitch.tv/asemtet0" target="_blank" class="btn btn-ghost">Assistir na Twitch</a>
            </div>
        </div>
        
        <div class="grid-2" style="margin-top: 32px;">
            <div class="card" id="cardStatus">
                <div class="skeleton" style="height: 120px;"></div>
            </div>
            <div class="card" id="cardVotos">
                <div class="skeleton" style="height: 120px;"></div>
            </div>
        </div>
    `;
    
    // Carregar dados reais
    loadTwitchStatus();
    loadVotosPreview();
}

async function loadTwitchStatus() {
    try {
        const res = await fetch(API.twitch);
        const data = await res.json();
        const el = $('#cardStatus');
        if(data.stream) {
            el.innerHTML = `
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
                    <span style="width:12px;height:12px;background:var(--danger);border-radius:50%;box-shadow:0 0 10px var(--danger);"></span>
                    <h3 style="font-size:1.2rem;">AO VIVO AGORA</h3>
                </div>
                <p style="color:var(--text-secondary);">${esc(data.stream.title)}</p>
                <p style="margin-top:8px;font-size:0.875rem;color:var(--text-muted);">${esc(data.stream.game_name)} • ${data.stream.viewer_count} viewers</p>
            `;
        } else {
            el.innerHTML = `
                <h3 style="font-size:1.2rem;margin-bottom:8px;">Offline 💤</h3>
                <p style="color:var(--text-secondary);">A Soso está descansando, mas logo volta!</p>
            `;
        }
    } catch(e) { console.error(e); }
}

async function loadVotosPreview() {
    try {
        const res = await fetch(API.votos);
        const data = await res.json();
        const el = $('#cardVotos');
        if(data.opcoes && data.opcoes.length > 0) {
            const top = data.opcoes.sort((a,b) => b.votos - a.votos)[0];
            el.innerHTML = `
                <h3 style="font-size:1.2rem;margin-bottom:16px;">🗳️ Próximo na Votação</h3>
                <div style="display:flex;align-items:center;gap:16px;">
                    <img src="${esc(top.capa)}" style="width:60px;height:80px;object-fit:cover;border-radius:8px;">
                    <div>
                        <h4 style="font-size:1.1rem;">${esc(top.nome)}</h4>
                        <p style="color:var(--accent);font-weight:600;">${top.votos} votos</p>
                    </div>
                </div>
                <button class="btn btn-primary" style="width:100%;margin-top:20px;" onclick="mudarAba('comunidade')">Ir para Votação</button>
            `;
        }
    } catch(e) { console.error(e); }
}

// =========================================
// INIT
// =========================================
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    renderInicio();
    // Adicionar outras inicializações de abas aqui
});