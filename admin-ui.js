// =========================================
// ADMIN DASHBOARD (Sidebar Layout)
// =========================================
let ADMIN_STATE = { page: 'home', data: null };

function renderAdmin() {
    const sec = $('#sec-admin');
    sec.innerHTML = `
        <div class="admin-layout">
            <aside class="admin-sidebar">
                <h3>Painel de Controle</h3>
                <button class="admin-nav-item ${ADMIN_STATE.page === 'home' ? 'on' : ''}" onclick="setAdminPage('home')">
                    📊 Dashboard
                </button>
                <button class="admin-nav-item ${ADMIN_STATE.page === 'votacao' ? 'on' : ''}" onclick="setAdminPage('votacao')">
                    🗳️ Votação
                </button>
                <button class="admin-nav-item ${ADMIN_STATE.page === 'tierlist' ? 'on' : ''}" onclick="setAdminPage('tierlist')">
                    🎮 Tier List
                </button>
                <button class="admin-nav-item ${ADMIN_STATE.page === 'admins' ? 'on' : ''}" onclick="setAdminPage('admins')">
                    👥 Admins & Permissões
                </button>
                <button class="admin-nav-item ${ADMIN_STATE.page === 'banidos' ? 'on' : ''}" onclick="setAdminPage('banidos')">
                    🚫 Banidos
                </button>
                <button class="admin-nav-item ${ADMIN_STATE.page === 'config' ? 'on' : ''}" onclick="setAdminPage('config')">
                    ⚙️ Configurações
                </button>
                <button class="admin-nav-item ${ADMIN_STATE.page === 'backup' ? 'on' : ''}" onclick="setAdminPage('backup')">
                    💾 Backup
                </button>
            </aside>
            <main class="admin-content" id="adminContent">
                <div class="skeleton" style="height: 400px;"></div>
            </main>
        </div>
    `;
    loadAdminPage();
}

function setAdminPage(page) {
    ADMIN_STATE.page = page;
    renderAdmin();
}

async function loadAdminPage() {
    const content = $('#adminContent');
    switch(ADMIN_STATE.page) {
        case 'home': renderAdminHome(content); break;
        case 'votacao': await renderAdminVotacao(content); break;
        case 'tierlist': await renderAdminTierlist(content); break;
        case 'admins': await renderAdminAdmins(content); break;
        case 'banidos': await renderAdminBanidos(content); break;
        case 'config': await renderAdminConfig(content); break;
        case 'backup': await renderAdminBackup(content); break;
    }
}

// =========================================
// ADMIN PAGES
// =========================================
function renderAdminHome(el) {
    el.innerHTML = `
        <div class="admin-header">
            <h2>Dashboard</h2>
        </div>
        <div class="grid-3">
            <div class="card">
                <p style="color:var(--text-muted);font-size:0.875rem;">Total de Votos</p>
                <h3 style="font-size:2rem;margin-top:8px;" id="statVotos">...</h3>
            </div>
            <div class="card">
                <p style="color:var(--text-muted);font-size:0.875rem;">Jogos na Tier List</p>
                <h3 style="font-size:2rem;margin-top:8px;" id="statJogos">...</h3>
            </div>
            <div class="card">
                <p style="color:var(--text-muted);font-size:0.875rem;">Status do Site</p>
                <h3 style="font-size:2rem;margin-top:8px;color:var(--success);">Online</h3>
            </div>
        </div>
        <div class="card" style="margin-top:24px;">
            <h3 style="margin-bottom:16px;">Ações Rápidas</h3>
            <div style="display:flex;gap:12px;flex-wrap:wrap;">
                <button class="btn btn-primary" onclick="setAdminPage('votacao')">Gerenciar Votação</button>
                <button class="btn btn-ghost" onclick="setAdminPage('tierlist')">Editar Tier List</button>
                <button class="btn btn-ghost" onclick="setAdminPage('config')">Configurações Gerais</button>
            </div>
        </div>
    `;
    // Fetch stats
    fetch('/api/admin?action=votos').then(r=>r.json()).then(d => {
        const total = d.usuarios ? d.usuarios.length : 0;
        $('#statVotos').textContent = total;
    });
    fetch('/api/tierlist').then(r=>r.json()).then(d => {
        $('#statJogos').textContent = d.jogos ? d.jogos.length : 0;
    });
}

async function renderAdminVotacao(el) {
    el.innerHTML = `
        <div class="admin-header">
            <h2>Gerenciar Votação</h2>
            <button class="btn btn-danger" onclick="resetarVotacao()">🗑️ Resetar Tudo</button>
        </div>
        <div class="card">
            <div class="skeleton" style="height: 200px;"></div>
        </div>
    `;
    try {
        const res = await fetch('/api/admin?action=votos');
        const data = await res.json();
        let html = `<table class="data-table"><thead><tr><th>Usuário</th><th>Voto</th><th>Data</th></tr></thead><tbody>`;
        if(data.usuarios && data.usuarios.length > 0) {
            data.usuarios.forEach(u => {
                html += `<tr>
                    <td>${esc(u.username || u.userId)}</td>
                    <td>${esc(u.opcao)}</td>
                    <td style="color:var(--text-muted);">${u.ts ? new Date(u.ts).toLocaleString() : '-'}</td>
                </tr>`;
            });
        } else {
            html += `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:40px;">Nenhum voto ainda.</td></tr>`;
        }
        html += `</tbody></table>`;
        el.querySelector('.card').innerHTML = html;
    } catch(e) {
        el.querySelector('.card').innerHTML = `<p style="color:var(--danger);">Erro ao carregar votos.</p>`;
    }
}

async function resetarVotacao() {
    if(!confirm('Tem certeza que deseja APAGAR TODOS os votos?')) return;
    try {
        await fetch('/api/admin?action=reset', { method: 'POST' });
        toast('Votação resetada com sucesso!', 'success');
        loadAdminPage();
    } catch(e) { toast('Erro ao resetar', 'error'); }
}

// ... (O restante das funções admin como Tierlist, Admins, Config seguem a mesma lógica de fetch para suas APIs existentes, mas renderizando com as novas classes CSS `.card`, `.data-table`, `.btn`, etc.)