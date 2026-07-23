import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Descobre a página atual (ex: "servicos" a partir de servicos.html) e usa
// isso como o documento no Firestore onde o conteúdo editável fica salvo
const PAGE_KEY = window.location.pathname.split("/").pop().replace(".html", "") || "index";
const DOC_REF = doc(db, "pageContent", PAGE_KEY);
const DEFAULT_MAX = 200;

const CLOUDINARY_CLOUD_NAME = "q8dxz4wt";
const CLOUDINARY_UPLOAD_PRESET = "vqwjh0vl";

let isAdmin = false;
let bound = false;
let snapshot = null;
let imageOverlays = [];

// Alterações ficam "pendentes" aqui até o clique em Salvar
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

function truncate(str, max) {
    return (str || "").toString().slice(0, max);
}

function makeCounter(current, max) {
    const span = document.createElement("span");
    span.className = "admin-char-counter";
    span.textContent = `${current}/${max}`;
    return span;
}

function getEditableEls() {
    return document.querySelectorAll("[data-edit-key]");
}

function isImageField(el) {
    return el.tagName === "IMG";
}

async function uploadImage(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData }
    );
    const data = await response.json();
    return data.secure_url || null;
}

async function loadContent() {
    const els = getEditableEls();
    const snap = await getDoc(DOC_REF);

    if (!snap.exists()) {
        const initial = {};
        els.forEach(el => {
            initial[el.dataset.editKey] = isImageField(el) ? el.getAttribute("src") : el.textContent.trim();
        });
        await setDoc(DOC_REF, initial);
        return initial;
    }

    const data = snap.data();
    els.forEach(el => {
        const key = el.dataset.editKey;
        if (data[key] === undefined) return;
        if (isImageField(el)) {
            el.src = data[key];
        } else {
            el.textContent = data[key];
        }
    });
    return data;
}

function bindTextField(el) {
    const maxLen = parseInt(el.dataset.editMax, 10) || DEFAULT_MAX;
    const key = el.dataset.editKey;

    el.contentEditable = "true";
    el.classList.add("admin-editable");
    el.dataset.lastSavedValue = el.textContent.trim();

    const counter = makeCounter(el.textContent.length, maxLen);
    el.insertAdjacentElement("afterend", counter);

    el.addEventListener("input", () => {
        if (el.textContent.length > maxLen) {
            el.textContent = truncate(el.textContent, maxLen);
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

        el.classList.add("admin-dirty");
        pendingChanges.set(el, {
            save: async () => {
                try {
                    await updateDoc(DOC_REF, { [key]: value });
                    el.dataset.lastSavedValue = value;
                    el.classList.remove("admin-dirty");
                } catch (err) {
                    console.error("Erro ao salvar:", err);
                }
            },
            revert: () => {
                el.textContent = el.dataset.lastSavedValue;
                el.classList.remove("admin-dirty");
            }
        });
        el._savePromise = Promise.resolve();
    });
}

function bindImageField(el) {
    const key = el.dataset.editKey;
    el.dataset.lastSavedValue = el.getAttribute("src");

    let wrapper = el.parentElement;
    if (!wrapper.classList.contains("admin-image-wrapper")) {
        wrapper = document.createElement("div");
        wrapper.className = "admin-image-wrapper";
        el.parentNode.insertBefore(wrapper, el);
        wrapper.appendChild(el);
    }

    const overlay = document.createElement("label");
    overlay.className = "admin-photo-overlay admin-image-edit-overlay";
    overlay.title = "Trocar foto";
    overlay.innerHTML = '<i class="fas fa-camera"></i>';

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.style.display = "none";
    fileInput.addEventListener("change", async () => {
        if (!fileInput.files[0]) return;
        const url = await uploadImage(fileInput.files[0]);
        if (!url) {
            if (window.showToast) {
                window.showToast("Não foi possível enviar a foto.", "fa-exclamation-circle", true);
            }
            return;
        }
        el.src = url;
        el.classList.add("admin-dirty-image");
        pendingChanges.set(el, {
            save: async () => {
                try {
                    await updateDoc(DOC_REF, { [key]: url });
                    el.dataset.lastSavedValue = url;
                    el.classList.remove("admin-dirty-image");
                } catch (err) {
                    console.error("Erro ao salvar:", err);
                }
            },
            revert: () => {
                el.src = el.dataset.lastSavedValue;
                el.classList.remove("admin-dirty-image");
            }
        });
    });

    overlay.appendChild(fileInput);
    wrapper.appendChild(overlay);
    imageOverlays.push(overlay);
}

function bindEditing() {
    if (bound) return;
    bound = true;

    getEditableEls().forEach(el => {
        if (isImageField(el)) {
            bindImageField(el);
        } else {
            bindTextField(el);
        }
    });
}

function unbindEditing() {
    if (!bound) return;
    bound = false;

    getEditableEls().forEach(el => {
        if (isImageField(el)) return;
        el.contentEditable = "false";
        el.classList.remove("admin-editable");
        const counter = el.nextElementSibling;
        if (counter && counter.classList.contains("admin-char-counter")) {
            counter.remove();
        }
    });

    imageOverlays.forEach(overlay => overlay.remove());
    imageOverlays = [];
}

function captureSnapshot() {
    snapshot = {};
    getEditableEls().forEach(el => {
        snapshot[el.dataset.editKey] = isImageField(el) ? el.getAttribute("src") : el.textContent;
    });
}

// Desfaz as edições feitas nesta página desde o login atual
async function cancelPageEdits() {
    if (!snapshot) return false;
    pendingChanges.clear();
    await setDoc(DOC_REF, snapshot, { merge: true });
    getEditableEls().forEach(el => {
        const key = el.dataset.editKey;
        if (snapshot[key] === undefined) return;
        if (isImageField(el)) {
            el.src = snapshot[key];
            el.classList.remove("admin-dirty-image");
        } else {
            el.textContent = snapshot[key];
            el.classList.remove("admin-dirty");
        }
    });
    captureSnapshot();
    return true;
}
window.cancelPageEdits = cancelPageEdits;

const dataReadyPromise = (async function init() {
    await loadContent();
})();

onAuthStateChanged(auth, async (user) => {
    const wasAdmin = isAdmin;
    isAdmin = !!user;
    if (isAdmin) {
        await dataReadyPromise;
        bindEditing();
        if (!wasAdmin) captureSnapshot();
    } else {
        unbindEditing();
        snapshot = null;
    }
});
