import { auth } from "./firebase-config.js";
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const NAV_LINKS = [
    { href: "index.html", label: "INÍCIO", page: "index.html" },
    { href: "quemsomos.html", label: "QUEM SOMOS", page: "quemsomos.html" },
    { href: "produtos-geral.html", label: "PRODUTOS", page: "produtos-geral.html" },
    { href: "servicos.html", label: "SERVIÇOS", page: "servicos.html" },
    { href: "localizacao.html", label: "LOCALIZAÇÃO", page: "localizacao.html" },
    { href: "index.html#contato", label: "CONTATO", page: null }
];

function getCurrentPage() {
    const file = window.location.pathname.split("/").pop();
    return file === "" ? "index.html" : file;
}

function buildHeaderHTML() {
    const currentPage = getCurrentPage();
    const navHTML = NAV_LINKS.map(link => {
        const activeClass = link.page === currentPage ? ' class="active"' : "";
        return `<a href="${link.href}"${activeClass}>${link.label}</a>`;
    }).join("\n                ");

    return `
    <div class="container nav-content">
        <a href="index.html" class="logo">MAQUI <span class="logo-text">PONTO</span></a>

        <nav class="nav">
            ${navHTML}
        </nav>

        <div class="header-actions">
            <button class="nav-toggle" aria-label="Abrir menu" aria-expanded="false">
                <span></span>
                <span></span>
                <span></span>
            </button>

            <a href="https://wa.me/5545998608682?text=Olá! Estava visitando o site da Maquiponto e gostaria de falar com um responsável."
                class="btn-primary header-cta" target="_blank" rel="noopener">
                <i class="fab fa-whatsapp"></i> SOLICITE UM ORÇAMENTO
            </a>

            <div class="admin-panel admin-panel-header">
                <button id="admin-toggle" class="admin-toggle-btn" title="Acesso Admin">
                    <i class="fas fa-user-lock"></i>
                </button>

                <div id="admin-login-box" class="admin-login-box hidden">
                    <div class="admin-login-header">
                        <span class="admin-login-icon-badge"><i class="fas fa-lock admin-login-icon"></i></span>
                        <h4>ACESSO ADMINISTRADOR</h4>
                    </div>
                    <p class="admin-login-subtitle">Painel de acesso restrito.</p>

                    <div class="admin-input-wrapper">
                        <i class="fas fa-envelope admin-input-icon"></i>
                        <input type="email" id="admin-email" placeholder="E-mail">
                    </div>

                    <div class="admin-input-wrapper">
                        <i class="fas fa-lock admin-input-icon"></i>
                        <input type="password" id="admin-password" placeholder="Senha">
                        <button type="button" id="admin-toggle-password" class="admin-toggle-password" tabindex="-1" title="Mostrar senha">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>

                    <button id="admin-login-btn" class="admin-login-submit">
                        Entrar <i class="fas fa-arrow-right"></i>
                    </button>

                    <p id="admin-login-error" class="admin-login-error"></p>
                </div>

                <div id="admin-bar" class="admin-bar hidden">
                    <span class="admin-bar-status"><i class="fas fa-pen"></i> Modo edição</span>
                    <button id="admin-save-btn" class="admin-bar-btn admin-bar-btn-save"><i class="fas fa-check"></i> Salvar</button>
                    <button id="admin-cancel-btn" class="admin-bar-btn admin-bar-btn-cancel"><i class="fas fa-undo"></i> Cancelar</button>
                    <button id="admin-logout" class="admin-bar-btn admin-bar-btn-exit"><i class="fas fa-sign-out-alt"></i> Sair</button>
                </div>
            </div>
        </div>
    </div>`;
}

const mount = document.getElementById("site-header");
if (mount) {
    mount.outerHTML = `<header class="header">${buildHeaderHTML()}</header>`;
}

// ================= LOGIN / ADMIN (compartilhado em todas as páginas) =================

const adminToggle = document.getElementById("admin-toggle");
const adminLoginBox = document.getElementById("admin-login-box");
const adminBar = document.getElementById("admin-bar");
const adminEmail = document.getElementById("admin-email");
const adminPassword = document.getElementById("admin-password");
const adminLoginBtn = document.getElementById("admin-login-btn");
const adminLoginError = document.getElementById("admin-login-error");
const adminLogoutBtn = document.getElementById("admin-logout");
const adminSaveBtn = document.getElementById("admin-save-btn");
const adminCancelBtn = document.getElementById("admin-cancel-btn");
const adminTogglePassword = document.getElementById("admin-toggle-password");

// Aviso central de "Salvo!" que aparece no meio da tela
// Usa um contêiner fixo cobrindo a tela inteira (inset:0) + flexbox pra
// centralizar - isso não depende de cálculo de %/vw/px, então não tem
// como sair torto em nenhuma página, com ou sem barra de rolagem.
function showToast(message, icon = "fa-check-circle", isError = false) {
    const overlay = document.createElement("div");
    overlay.className = "admin-toast-overlay";

    const toast = document.createElement("div");
    toast.className = "admin-toast" + (isError ? " is-error" : "");
    toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;

    overlay.appendChild(toast);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => toast.classList.add("is-visible"));

    setTimeout(() => {
        toast.classList.remove("is-visible");
        setTimeout(() => overlay.remove(), 500);
    }, 2600);
}
window.showToast = showToast;

// Modal customizado pra substituir o confirm() feio do navegador
function showConfirm(message, confirmLabel = "Confirmar", cancelLabel = "Cancelar") {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "admin-prompt-overlay";
        overlay.innerHTML = `
            <div class="admin-prompt-box admin-confirm-box">
                <i class="fas fa-triangle-exclamation admin-confirm-icon"></i>
                <p class="admin-confirm-message">${message}</p>
                <div class="admin-prompt-actions">
                    <button type="button" class="admin-prompt-cancel">${cancelLabel}</button>
                    <button type="button" class="admin-prompt-confirm admin-prompt-confirm-danger">${confirmLabel}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add("is-visible"));

        const confirmBtn = overlay.querySelector(".admin-prompt-confirm");
        const cancelBtn = overlay.querySelector(".admin-prompt-cancel");

        function close(value) {
            overlay.classList.remove("is-visible");
            setTimeout(() => overlay.remove(), 200);
            resolve(value);
        }

        confirmBtn.addEventListener("click", () => close(true));
        cancelBtn.addEventListener("click", () => close(false));
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) close(false);
        });
        document.addEventListener("keydown", function onKey(e) {
            if (e.key === "Escape") { close(false); document.removeEventListener("keydown", onKey); }
        });
    });
}
window.showConfirm = showConfirm;

// Salva o campo que estiver em edição no momento (usado antes de sair/salvar)
async function flushActiveEdit() {
    const active = document.activeElement;
    if (active && active.classList && active.classList.contains("admin-editable")) {
        active.blur();
        if (active._savePromise) await active._savePromise;
    }
}
window.flushActiveEdit = flushActiveEdit;

if (adminToggle) {
    adminToggle.addEventListener("click", () => {
        adminLoginBox.classList.toggle("hidden");
    });
}

if (adminLoginBtn) {
    adminLoginBtn.addEventListener("click", async () => {
        adminLoginError.style.color = "";
        adminLoginError.textContent = "";
        try {
            await signInWithEmailAndPassword(auth, adminEmail.value.trim(), adminPassword.value);
        } catch (err) {
            adminLoginError.textContent = "E-mail ou senha incorretos.";
        }
    });
}

if (adminTogglePassword) {
    adminTogglePassword.addEventListener("click", () => {
        const isPassword = adminPassword.type === "password";
        adminPassword.type = isPassword ? "text" : "password";
        adminTogglePassword.innerHTML = isPassword
            ? '<i class="fas fa-eye-slash"></i>'
            : '<i class="fas fa-eye"></i>';
    });
}

async function persistPendingChanges() {
    if (typeof window.saveAllPendingChanges === "function") {
        await window.saveAllPendingChanges();
    }
}

function pageHasPendingChanges() {
    return typeof window.hasPendingChanges === "function" && window.hasPendingChanges();
}

function discardPendingChanges() {
    if (typeof window.discardAllPendingChanges === "function") {
        window.discardAllPendingChanges();
    }
}

if (adminSaveBtn) {
    adminSaveBtn.addEventListener("click", async () => {
        adminSaveBtn.disabled = true;
        await flushActiveEdit();
        await persistPendingChanges();
        showToast("Alterações salvas com sucesso!");
        adminSaveBtn.disabled = false;
    });
}

if (adminCancelBtn) {
    adminCancelBtn.addEventListener("click", async () => {
        const confirmed = await showConfirm("Descartar todas as alterações feitas nesta sessão de edição?", "Descartar");
        if (!confirmed) return;
        adminCancelBtn.disabled = true;
        if (typeof window.cancelProductEdits === "function") {
            await window.cancelProductEdits();
            showToast("Alterações descartadas.", "fa-undo");
        } else if (typeof window.cancelPageEdits === "function") {
            await window.cancelPageEdits();
            showToast("Alterações descartadas.", "fa-undo");
        } else {
            showToast("Nada para desfazer nesta página.", "fa-info-circle");
        }
        adminCancelBtn.disabled = false;
    });
}

if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener("click", async () => {
        await flushActiveEdit();

        if (pageHasPendingChanges()) {
            const wantsSave = await showConfirm(
                "Você tem alterações não salvas. Deseja salvar antes de sair?",
                "Salvar",
                "Cancelar"
            );
            adminLogoutBtn.disabled = true;
            if (wantsSave) {
                await persistPendingChanges();
            } else {
                discardPendingChanges();
            }
            adminLogoutBtn.disabled = false;
        }

        await signOut(auth);
    });
}

onAuthStateChanged(auth, (user) => {
    const isAdmin = !!user;
    if (adminLoginBox && isAdmin) adminLoginBox.classList.add("hidden");
    if (adminToggle) adminToggle.classList.toggle("hidden", isAdmin);
    if (adminBar) adminBar.classList.toggle("hidden", !isAdmin);
});

// Reaplica o comportamento do menu mobile (hamburguer) já que o header
// foi injetado depois do script.js original ser carregado
const header = document.querySelector(".header");
const navBtn = document.querySelector(".nav-toggle");
if (navBtn && header) {
    navBtn.addEventListener("click", () => {
        header.classList.toggle("is-open");
        const expanded = header.classList.contains("is-open");
        navBtn.setAttribute("aria-expanded", expanded);
    });
}
