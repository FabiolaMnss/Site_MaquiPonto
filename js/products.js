import { auth, db } from "./firebase-config.js";
import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    collection,
    getDocs,
    doc,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const WHATSAPP_NUMBER = "5545998608682";

const MAX = {
    name: 50,
    description: 140,
    cta: 26
};

const CATEGORY_ADD_VALUE = "__add_new__";

const TECH_OPTIONS = [
    { value: "", label: "Nenhuma" },
    { value: "biometrico", label: "Biométrico" },
    { value: "cartografico", label: "Cartográfico" },
    { value: "facial", label: "Facial" }
];

// Catálogo inicial - usado para popular o Firestore na primeira vez
// (garante que nada do catálogo atual se perca na migração)
const SEED_PRODUCTS = [
    { name: "Henry Vega", specs: "Cartográfico | Portaria 671", description: "Relógio de ponto cartográfico de alta durabilidade e baixo custo.", tag: "BAIXO CUSTO", category: "relogio", tech: "cartografico", imageUrl: "img/imagem_vega.webp", cta: "Ver Detalhes", whatsappMessage: "Olá! Gostaria de um orçamento do Relógio Henry Vega.", order: 1 },
    { name: "Henry Face", specs: "Reconhecimento Facial | Sem Contato", description: "Tecnologia de ponta com reconhecimento facial, garantindo máxima higiene e segurança na marcação do ponto.", tag: "TECNOLOGIA FACIAL", category: "relogio", tech: "facial", imageUrl: "img/relogio_facial.webp", cta: "Ver Detalhes", whatsappMessage: "Olá! Gostaria de um orçamento do Relógio com Reconhecimento Facial.", order: 2 },
    { name: "Henry Prisma SuperFácil", specs: "Biometria Digital", description: "Equipamento avançado com Biometria Digital ultrarrápida.", tag: "BIOMÉTRICO", category: "relogio", tech: "biometrico", imageUrl: "img/imagem_prisma.webp", cta: "Ver Detalhes", whatsappMessage: "Olá! Tenho interesse no Relógio Biométrico Prisma SuperFácil.", order: 3 },
    { name: "Henry Hexa", specs: "Biometria Digital", description: "Tecnologia para alta performance e grandes empresas.", tag: "BIOMÉTRICO", category: "relogio", tech: "biometrico", imageUrl: "img/imagem_hexa.jpg", cta: "Ver Detalhes", whatsappMessage: "Olá! Gostaria de um orçamento para o Relógio Henry Hexa.", order: 4 },
    { name: "Balança Atena", specs: "Capacidade 35 kg", description: "Balança de precisão ideal para supermercados e atacados.", tag: "MAIS VENDIDA", category: "balanca", tech: "", imageUrl: "img/imagem_balancaatena.webp", cta: "Ver Detalhes", whatsappMessage: "Olá! Gostaria de saber o preço da Balança Atena de 35kg.", order: 5 },
    { name: "Balança Ramuza", specs: "Comercial | Com Checklist", description: "Balança computadora ideal para comércios, oferecendo agilidade e precisão no atendimento ao cliente.", tag: "MAIS VENDIDA", category: "balanca", tech: "", imageUrl: "img/balança_ramuza.jpg", cta: "Ver Detalhes", whatsappMessage: "Olá! Gostaria de informações sobre a Balança Comercial Ramuza.", order: 6 },
    { name: "Bobinas Térmicas", specs: "Compatibilidade Henry", description: "Bobinas originais para todos os modelos de REP.", tag: "PRONTA ENTREGA", category: "pecas", tech: "", imageUrl: "img/imagem_bobina.jpg", cta: "Solicitar Orçamento", whatsappMessage: "Olá! Gostaria de encomendar Bobinas Térmicas para Relógio de Ponto.", order: 7 },
    { name: "Fita para Henry Vega", specs: "Alto Rendimento", description: "Fita tintada de alta qualidade para o Relógio Henry Vega.", tag: "PRONTA ENTREGA", category: "pecas", tech: "cartografico", imageUrl: "img/imagem_fitavega.jpg", cta: "Solicitar Orçamento", whatsappMessage: "Olá! Preciso de fita para o Relógio Henry Vega.", order: 8 },
    { name: "Fita para Henry Plus", specs: "Ótima Qualidade", description: "Fita de reposição indispensável para o modelo Henry Plus.", tag: "PRONTA ENTREGA", category: "pecas", tech: "cartografico", imageUrl: "img/imagem_fitaplus.webp", cta: "Solicitar Orçamento", whatsappMessage: "Olá! Preciso de fita para o Relógio Henry Plus.", order: 9 },
    { name: "Cartão Ponto Henry Vega", specs: "Pacotes com 100 un.", description: "Cartões de ponto mensais/semanais para uso no Cartográfico.", tag: "PRONTA ENTREGA", category: "pecas", tech: "cartografico", imageUrl: "img/imagem_cartaovega.jpg", cta: "Solicitar Orçamento", whatsappMessage: "Olá! Gostaria de comprar pacotes de Cartão Ponto para Henry Vega.", order: 10 },
    { name: "Cartão Ponto Henry Plus", specs: "Pacotes com 100 un.", description: "Cartões de alta resistência compatíveis com o modelo Plus.", tag: "PRONTA ENTREGA", category: "pecas", tech: "cartografico", imageUrl: "img/imagem_cartaoplus.webp", cta: "Solicitar Orçamento", whatsappMessage: "Olá! Gostaria de comprar pacotes de Cartão Ponto para Henry Plus.", order: 11 }
];

const CLOUDINARY_CLOUD_NAME = "q8dxz4wt";
const CLOUDINARY_UPLOAD_PRESET = "vqwjh0vl";

let products = [];
let categories = [];
let isAdmin = false;
let draggedProductId = null;
let productsSnapshot = null;
let heroSnapshot = null;

// Alterações de texto ficam "pendentes" aqui até o clique em Salvar
const pendingChanges = new Map();

function hasPendingChanges() {
    return pendingChanges.size > 0;
}

async function saveAllPendingChanges() {
    const entries = Array.from(pendingChanges.values());
    pendingChanges.clear();
    await Promise.all(entries.map(entry => entry.save()));
}

function discardAllPendingChanges() {
    const entries = Array.from(pendingChanges.values());
    pendingChanges.clear();
    entries.forEach(entry => entry.revert());
}

window.hasPendingChanges = hasPendingChanges;
window.saveAllPendingChanges = saveAllPendingChanges;
window.discardAllPendingChanges = discardAllPendingChanges;

const grid = document.getElementById("productGrid");
const sidebarFilters = document.querySelector(".sidebar-filters");
const categoryFilterGroup = document.getElementById("category-filter-group");

function truncate(str, max) {
    return (str || "").toString().slice(0, max);
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
}

function slugify(text) {
    return text.toString().trim().toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || `categoria-${Date.now()}`;
}

async function loadCategories() {
    const snapshot = await getDocs(collection(db, "categories"));

    if (snapshot.empty) {
        const seedCategories = [
            { slug: "relogio", label: "Relógios de Ponto", order: 1 },
            { slug: "balanca", label: "Balanças Comerciais", order: 2 },
            { slug: "pecas", label: "Peças e Acessórios", order: 3 }
        ];
        for (const cat of seedCategories) {
            await setDoc(doc(db, "categories", cat.slug), cat);
        }
        return loadCategories();
    }

    categories = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
}

async function createCategory(label) {
    const slug = slugify(label);
    const existing = categories.find(c => c.id === slug);
    if (existing) return existing.id;

    const newCategory = { slug, label, order: categories.length + 1 };
    await setDoc(doc(db, "categories", slug), newCategory);
    categories.push({ id: slug, ...newCategory });
    renderCategoryFilters();
    return slug;
}

function renderCategoryFilters() {
    if (!categoryFilterGroup) return;
    categoryFilterGroup.querySelectorAll("label").forEach(label => label.remove());

    categories.forEach(cat => {
        const label = document.createElement("label");
        label.className = "admin-category-label";

        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = cat.id;
        label.appendChild(input);
        label.appendChild(document.createTextNode(" " + cat.label));

        if (isAdmin) {
            const delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "admin-category-delete";
            delBtn.innerHTML = '<i class="fas fa-times"></i>';
            delBtn.title = "Excluir categoria";
            delBtn.addEventListener("click", async (e) => {
                e.preventDefault();
                await deleteCategory(cat.id, cat.label);
            });
            label.appendChild(delBtn);
        }

        categoryFilterGroup.appendChild(label);
    });
}

async function deleteCategory(categoryId, label) {
    const inUse = products.filter(p => p.category === categoryId).length;
    if (inUse > 0) {
        if (window.showToast) {
            window.showToast(
                `Não dá pra excluir: ${inUse} produto(s) ainda usam "${label}".`,
                "fa-exclamation-circle",
                true
            );
        }
        return;
    }

    const confirmed = window.showConfirm
        ? await window.showConfirm(`Excluir a categoria "${escapeHtml(label)}"?`, "Excluir")
        : confirm(`Excluir a categoria "${label}"?`);
    if (!confirmed) return;

    await deleteDoc(doc(db, "categories", categoryId));
    categories = categories.filter(c => c.id !== categoryId);
    renderCategoryFilters();
    renderProducts();
}

// Modal customizado pra substituir o prompt() feio do navegador
function showPrompt(title, placeholder = "") {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "admin-prompt-overlay";
        overlay.innerHTML = `
            <div class="admin-prompt-box">
                <p class="admin-prompt-title">${escapeHtml(title)}</p>
                <input type="text" class="admin-prompt-input" placeholder="${escapeHtml(placeholder)}">
                <div class="admin-prompt-actions">
                    <button type="button" class="admin-prompt-cancel">Cancelar</button>
                    <button type="button" class="admin-prompt-confirm">Adicionar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add("is-visible"));

        const input = overlay.querySelector(".admin-prompt-input");
        const confirmBtn = overlay.querySelector(".admin-prompt-confirm");
        const cancelBtn = overlay.querySelector(".admin-prompt-cancel");
        input.focus();

        function close(value) {
            overlay.classList.remove("is-visible");
            setTimeout(() => overlay.remove(), 200);
            resolve(value);
        }

        confirmBtn.addEventListener("click", () => close(input.value.trim() || null));
        cancelBtn.addEventListener("click", () => close(null));
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) close(null);
        });
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") close(input.value.trim() || null);
            if (e.key === "Escape") close(null);
        });
    });
}

async function loadProducts() {
    const snapshot = await getDocs(collection(db, "products"));

    if (snapshot.empty) {
        for (const seed of SEED_PRODUCTS) {
            await addDoc(collection(db, "products"), seed);
        }
        return loadProducts();
    }

    products = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
}

function buildWhatsAppLink(product) {
    const msg = product.whatsappMessage || `Olá! Tenho interesse no produto ${product.name}.`;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

function buildSelect(options, selectedValue, dataField) {
    const select = document.createElement("select");
    select.className = "admin-inline-select";
    select.dataset.field = dataField;
    options.forEach(opt => {
        const option = document.createElement("option");
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === selectedValue) option.selected = true;
        select.appendChild(option);
    });
    return select;
}

function makeCounter(current, max) {
    const span = document.createElement("span");
    span.className = "admin-char-counter";
    span.textContent = `${current}/${max}`;
    return span;
}

function attachEditableField(el, maxLen, onSave, onLocalApply) {
    el.contentEditable = "true";
    el.classList.add("admin-editable");
    el.dataset.lastSavedValue = el.textContent.trim();

    const counter = makeCounter(el.textContent.length, maxLen);
    el.insertAdjacentElement("afterend", counter);

    el.addEventListener("input", () => {
        if (el.textContent.length > maxLen) {
            el.textContent = truncate(el.textContent, maxLen);
            // Move cursor to the end after truncating
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
        counter.textContent = `${el.textContent.length}/${maxLen}`;
    });

    el.addEventListener("blur", () => {
        const value = truncate(el.textContent.trim(), maxLen);

        if (value === el.dataset.lastSavedValue) {
            pendingChanges.delete(el);
            el.classList.remove("admin-dirty");
            return;
        }

        // Atualiza o modelo em memória na hora (pra não perder a edição se a
        // página re-renderizar antes de salvar), mas só grava no Firebase
        // quando "Salvar" for clicado
        if (onLocalApply) onLocalApply(value);

        el.classList.add("admin-dirty");
        pendingChanges.set(el, {
            save: async () => {
                try {
                    await onSave(value);
                    el.dataset.lastSavedValue = value;
                    el.classList.remove("admin-dirty");
                } catch (err) {
                    console.error("Erro ao salvar:", err);
                }
            },
            revert: () => {
                el.textContent = el.dataset.lastSavedValue;
                if (onLocalApply) onLocalApply(el.dataset.lastSavedValue);
                el.classList.remove("admin-dirty");
            }
        });
        // Compatibilidade com flushActiveEdit (só marca o campo, não salva)
        el._savePromise = Promise.resolve();
    });
}

function attachProductField(el, product, field, maxLen) {
    attachEditableField(
        el, maxLen,
        async (value) => {
            await updateDoc(doc(db, "products", product.id), { [field]: value });
        },
        (value) => {
            product[field] = value;
        }
    );
}

// Usado pelos seletores (categoria/tecnologia), que não têm um campo de
// texto pra ancorar a mudança pendente - fica registrada por produto+campo
function stageFieldChange(product, field, newValue) {
    const key = `${product.id}:${field}`;
    const existing = pendingChanges.get(key);
    const originalValue = existing ? existing.originalValue : product[field];

    product[field] = newValue;

    if (newValue === originalValue) {
        pendingChanges.delete(key);
        return;
    }

    pendingChanges.set(key, {
        originalValue,
        save: async () => {
            await updateDoc(doc(db, "products", product.id), { [field]: newValue });
        },
        revert: () => {
            product[field] = originalValue;
            renderProducts();
        }
    });
}

async function handleImageUpload(file, product) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData }
    );
    const data = await response.json();

    if (data.secure_url) {
        product.imageUrl = data.secure_url;
        await updateDoc(doc(db, "products", product.id), { imageUrl: data.secure_url });
        await loadProducts();
        renderProducts();
    } else if (window.showToast) {
        window.showToast("Não foi possível enviar a foto.", "fa-exclamation-circle", true);
    }
}

function createProductCard(product) {
    const card = document.createElement("div");
    card.className = `product-card ${product.category} ${product.tech || ""} is-visible`;
    card.dataset.id = product.id;

    const imageContainer = document.createElement("div");
    imageContainer.className = "product-image-container";

    let img;
    if (product.imageUrl) {
        img = document.createElement("img");
        img.src = product.imageUrl;
        img.alt = product.name;
        img.className = "product-img";
    } else {
        img = document.createElement("div");
        img.className = "product-img-placeholder";
        img.innerHTML = '<i class="fas fa-image"></i><span>Sem foto</span>';
    }
    imageContainer.appendChild(img);

    const tag = document.createElement("span");
    tag.className = "product-tag primary-bg";
    tag.textContent = product.tag || "";
    imageContainer.appendChild(tag);

    card.appendChild(imageContainer);

    const h3 = document.createElement("h3");
    h3.textContent = product.name;
    card.appendChild(h3);

    const desc = document.createElement("p");
    desc.textContent = product.description || "";
    card.appendChild(desc);

    const link = document.createElement("a");
    link.className = "btn-link";
    link.target = "_blank";
    link.href = buildWhatsAppLink(product);
    link.textContent = product.cta || "Ver Detalhes";
    card.appendChild(link);

    if (isAdmin) {
        // Botão de excluir
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "admin-delete-btn";
        deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
        deleteBtn.title = "Excluir produto";
        deleteBtn.addEventListener("click", async () => {
            const confirmed = window.showConfirm
                ? await window.showConfirm(`Excluir "${escapeHtml(product.name)}"? Essa ação não pode ser desfeita.`, "Excluir")
                : confirm(`Excluir "${product.name}"? Essa ação não pode ser desfeita.`);
            if (confirmed) {
                await deleteDoc(doc(db, "products", product.id));
                await loadProducts();
                renderProducts();
            }
        });
        card.appendChild(deleteBtn);

        // Overlay pra trocar foto
        const photoOverlay = document.createElement("label");
        photoOverlay.className = "admin-photo-overlay";
        photoOverlay.innerHTML = '<i class="fas fa-camera"></i>';
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.style.display = "none";
        fileInput.addEventListener("change", () => {
            if (fileInput.files[0]) {
                handleImageUpload(fileInput.files[0], product);
            }
        });
        photoOverlay.appendChild(fileInput);
        imageContainer.appendChild(photoOverlay);

        // Campos editáveis (apenas título, um campo de texto e o botão)
        attachProductField(h3, product, "name", MAX.name);
        desc.classList.add("admin-field-box");
        attachProductField(desc, product, "description", MAX.description);
        attachProductField(link, product, "cta", MAX.cta);

        // Seletores de categoria/tecnologia
        const controls = document.createElement("div");
        controls.className = "admin-select-row";

        const catOptions = categories.map(c => ({ value: c.id, label: c.label }));
        catOptions.push({ value: CATEGORY_ADD_VALUE, label: "+ Nova categoria..." });
        const catSelect = buildSelect(catOptions, product.category, "category");
        catSelect.addEventListener("change", async () => {
            if (catSelect.value === CATEGORY_ADD_VALUE) {
                const label = await showPrompt("Nome da nova categoria", "Ex: Catracas");
                if (!label) {
                    catSelect.value = product.category;
                    return;
                }
                try {
                    const slug = await createCategory(label.trim());
                    stageFieldChange(product, "category", slug);
                    renderProducts();
                } catch (err) {
                    console.error("Erro ao criar categoria:", err);
                    if (window.showToast) {
                        window.showToast("Não foi possível criar a categoria.", "fa-exclamation-circle", true);
                    }
                    catSelect.value = product.category;
                }
                return;
            }
            stageFieldChange(product, "category", catSelect.value);
            renderProducts();
        });

        const techSelect = buildSelect(TECH_OPTIONS, product.tech || "", "tech");
        techSelect.addEventListener("change", () => {
            stageFieldChange(product, "tech", techSelect.value);
            renderProducts();
        });

        controls.appendChild(catSelect);
        controls.appendChild(techSelect);
        card.insertBefore(controls, imageContainer);

        // Arrastar para reordenar
        const dragHandle = document.createElement("div");
        dragHandle.className = "admin-drag-handle";
        dragHandle.innerHTML = '<i class="fas fa-grip-vertical"></i>';
        card.appendChild(dragHandle);
        attachDragHandlers(card, product);
    }

    return card;
}

function attachDragHandlers(card, product) {
    const handle = card.querySelector(".admin-drag-handle");
    if (!handle) return;

    handle.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        draggedProductId = product.id;

        const rect = card.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;

        const placeholder = document.createElement("div");
        placeholder.className = "product-card-placeholder";
        placeholder.style.width = rect.width + "px";
        placeholder.style.height = rect.height + "px";
        card.parentNode.insertBefore(placeholder, card.nextSibling);

        card.style.position = "fixed";
        card.style.width = rect.width + "px";
        card.style.left = rect.left + "px";
        card.style.top = rect.top + "px";
        card.classList.add("is-dragging-floating");
        document.body.classList.add("is-reordering");

        function onMove(moveEvent) {
            card.style.left = (moveEvent.clientX - offsetX) + "px";
            card.style.top = (moveEvent.clientY - offsetY) + "px";

            card.style.pointerEvents = "none";
            const elemBelow = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
            card.style.pointerEvents = "";
            if (!elemBelow) return;

            const targetCard = elemBelow.closest(".product-card");
            if (targetCard && targetCard !== card && grid.contains(targetCard)) {
                const targetRect = targetCard.getBoundingClientRect();
                const isAfter = moveEvent.clientY > targetRect.top + targetRect.height / 2;
                grid.insertBefore(placeholder, isAfter ? targetCard.nextSibling : targetCard);
            }
        }

        async function onUp(upEvent) {
            handle.releasePointerCapture(upEvent.pointerId);
            handle.removeEventListener("pointermove", onMove);
            handle.removeEventListener("pointerup", onUp);
            document.body.classList.remove("is-reordering");

            const orderedIds = Array.from(grid.children)
                .filter(el => el !== card && (el.classList.contains("product-card") || el === placeholder))
                .map(el => el === placeholder ? product.id : el.dataset.id);

            placeholder.remove();
            card.style.position = "";
            card.style.width = "";
            card.style.left = "";
            card.style.top = "";
            card.classList.remove("is-dragging-floating");
            draggedProductId = null;

            await applyNewOrder(orderedIds);
        }

        handle.setPointerCapture(e.pointerId);
        handle.addEventListener("pointermove", onMove);
        handle.addEventListener("pointerup", onUp);
    });
}

async function applyNewOrder(orderedVisibleIds) {
    const visibleSet = new Set(orderedVisibleIds);
    const slots = [];
    products.forEach((p, idx) => { if (visibleSet.has(p.id)) slots.push(idx); });

    const reorderedVisible = orderedVisibleIds.map(id => products.find(p => p.id === id));
    slots.forEach((slotIndex, i) => { products[slotIndex] = reorderedVisible[i]; });

    await Promise.all(products.map((p, index) => {
        const newOrder = index + 1;
        if (p.order === newOrder) return Promise.resolve();
        p.order = newOrder;
        return updateDoc(doc(db, "products", p.id), { order: newOrder });
    }));

    renderProducts();
}

function getActiveFilters() {
    return Array.from(document.querySelectorAll('.sidebar-filters input[type="checkbox"]:checked'))
        .map(cb => cb.value);
}

function renderProducts() {
    if (!grid) return;
    grid.innerHTML = "";

    const activeFilters = getActiveFilters();
    const visibleProducts = activeFilters.length === 0
        ? products
        : products.filter(p => activeFilters.includes(p.category) || activeFilters.includes(p.tech));

    visibleProducts.forEach(product => {
        grid.appendChild(createProductCard(product));
    });

    if (isAdmin) {
        const addBtn = document.createElement("button");
        addBtn.className = "admin-add-card";
        addBtn.innerHTML = '<i class="fas fa-plus"></i> Novo Produto';
        addBtn.addEventListener("click", async () => {
            const newDoc = await addDoc(collection(db, "products"), {
                name: "Novo Produto",
                specs: "",
                description: "",
                tag: "NOVIDADE",
                category: "relogio",
                tech: "",
                imageUrl: "",
                cta: "Ver Detalhes",
                whatsappMessage: "Olá! Tenho interesse neste produto.",
                order: products.length + 1
            });
            await loadProducts();
            renderProducts();
        });
        grid.appendChild(addBtn);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const filtroURL = urlParams.get("filtro");
    if (filtroURL) {
        const checkboxParaMarcar = document.querySelector(`.sidebar-filters input[value="${filtroURL}"]`);
        if (checkboxParaMarcar) checkboxParaMarcar.checked = true;
    }
}

// Delegação de evento: funciona mesmo com categorias criadas depois
if (sidebarFilters) {
    sidebarFilters.addEventListener("change", (e) => {
        if (e.target.matches('input[type="checkbox"]')) renderProducts();
    });
}

// ================= TÍTULO DO TOPO DA PÁGINA =================

const HERO_MAX = { titleLine1: 40, titleLine2: 40, subtitle: 160 };
const heroLine1El = document.getElementById("hero-title-line1");
const heroLine2El = document.getElementById("hero-title-line2");
const heroSubtitleEl = document.getElementById("hero-subtitle");
const HERO_DOC_REF = doc(db, "pageContent", "produtosHero");
let heroContentBound = false;

async function loadHeroContent() {
    const snap = await getDoc(HERO_DOC_REF);

    if (!snap.exists()) {
        const initial = {
            titleLine1: heroLine1El ? heroLine1El.textContent.trim() : "",
            titleLine2: heroLine2El ? heroLine2El.textContent.trim() : "",
            subtitle: heroSubtitleEl ? heroSubtitleEl.textContent.trim() : ""
        };
        await setDoc(HERO_DOC_REF, initial);
        return initial;
    }

    return snap.data();
}

function bindHeroEditing() {
    if (heroContentBound) return;
    heroContentBound = true;

    if (heroLine1El) {
        attachEditableField(heroLine1El, HERO_MAX.titleLine1, async (value) => {
            await updateDoc(HERO_DOC_REF, { titleLine1: value });
        });
    }
    if (heroLine2El) {
        attachEditableField(heroLine2El, HERO_MAX.titleLine2, async (value) => {
            await updateDoc(HERO_DOC_REF, { titleLine2: value });
        });
    }
    if (heroSubtitleEl) {
        attachEditableField(heroSubtitleEl, HERO_MAX.subtitle, async (value) => {
            await updateDoc(HERO_DOC_REF, { subtitle: value });
        });
    }
}

function unbindHeroEditing() {
    if (!heroContentBound) return;
    heroContentBound = false;

    [heroLine1El, heroLine2El, heroSubtitleEl].forEach(el => {
        if (!el) return;
        el.contentEditable = "false";
        el.classList.remove("admin-editable");
        const counter = el.nextElementSibling;
        if (counter && counter.classList.contains("admin-char-counter")) {
            counter.remove();
        }
    });
}

async function initHeroContent() {
    const content = await loadHeroContent();
    if (heroLine1El && content.titleLine1) heroLine1El.textContent = content.titleLine1;
    if (heroLine2El && content.titleLine2) heroLine2El.textContent = content.titleLine2;
    if (heroSubtitleEl && content.subtitle) heroSubtitleEl.textContent = content.subtitle;

    if (isAdmin) bindHeroEditing();
}

// ================= ESTADO DE LOGIN =================
// O login/logout em si é controlado pelo js/header.js (compartilhado em
// todas as páginas). Aqui só reagimos à mudança de estado pra desenhar
// os produtos e o título em modo de edição.

function captureSessionSnapshot() {
    productsSnapshot = JSON.parse(JSON.stringify(products));
    heroSnapshot = {
        titleLine1: heroLine1El ? heroLine1El.textContent : "",
        titleLine2: heroLine2El ? heroLine2El.textContent : "",
        subtitle: heroSubtitleEl ? heroSubtitleEl.textContent : ""
    };
}

// Desfaz tudo que foi editado/adicionado/excluído/reordenado desde que
// o admin logou, restaurando o catálogo exatamente como estava antes
async function cancelSessionEdits() {
    if (!productsSnapshot) return false;

    // Joga fora qualquer alteração ainda não salva antes de reverter a sessão
    pendingChanges.clear();

    const snapshotIds = new Set(productsSnapshot.map(p => p.id));

    // Restaura (ou recria, se foi excluído) cada produto do retrato original
    await Promise.all(productsSnapshot.map(p => {
        const { id, ...data } = p;
        return setDoc(doc(db, "products", id), data);
    }));

    // Remove produtos criados durante a sessão (não existiam no retrato)
    await Promise.all(products
        .filter(p => !snapshotIds.has(p.id))
        .map(p => deleteDoc(doc(db, "products", p.id)))
    );

    if (heroSnapshot) {
        await setDoc(HERO_DOC_REF, heroSnapshot);
    }

    await loadProducts();
    renderProducts();

    if (heroLine1El) heroLine1El.textContent = heroSnapshot.titleLine1;
    if (heroLine2El) heroLine2El.textContent = heroSnapshot.titleLine2;
    if (heroSubtitleEl) heroSubtitleEl.textContent = heroSnapshot.subtitle;

    captureSessionSnapshot();
    return true;
}
window.cancelProductEdits = cancelSessionEdits;

onAuthStateChanged(auth, async (user) => {
    const wasAdmin = isAdmin;
    isAdmin = !!user;
    if (isAdmin) {
        // Espera o catálogo/título terminarem de carregar antes de tirar o
        // "retrato" - evita capturar um estado vazio/incompleto (o que faria
        // o "Cancelar" apagar coisas de sessões/logins anteriores por engano)
        await dataReadyPromise;
        bindHeroEditing();
        if (!wasAdmin) captureSessionSnapshot();
    } else {
        unbindHeroEditing();
        productsSnapshot = null;
        heroSnapshot = null;
    }
    renderCategoryFilters();
    renderProducts();
});

// ================= INICIALIZAÇÃO =================

const dataReadyPromise = (async function init() {
    await loadCategories();
    renderCategoryFilters();
    await loadProducts();
    renderProducts();
    await initHeroContent();
})();
