document.addEventListener("DOMContentLoaded", () => {

    // =========================================================
    // 1) ANIMAÇÃO DE ELEMENTOS NO SCROLL
    // =========================================================
    const animatedElements = document.querySelectorAll(
        ".animate-up, .animate-fade, .animate-fade-left, .animate-fade-right, .animate-fade-up"
    );

    if (animatedElements.length) {
        const observerOptions = {
            root: null,
            rootMargin: "0px",
            threshold: 0.1,
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                }
            });
        }, observerOptions);

        animatedElements.forEach((el) => observer.observe(el));
    }

    // Obs: o menu mobile (hamburguer) agora é controlado pelo js/header.js,
    // já que o cabeçalho é injetado globalmente por ele.

    // ===============================================
    // 3) FILTRO DE PRODUTOS
    // ===============================================
    const checkboxes = document.querySelectorAll('.sidebar-filters input[type="checkbox"]');
    const cards = document.querySelectorAll(".product-card");

    function applyFilters() {
        // Pega todos os values dos checkboxes que estão marcados
        const activeFilters = Array.from(checkboxes)
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.value);

        cards.forEach(card => {
            // Se nenhum checkbox estiver marcado, mostra tudo
            if (activeFilters.length === 0) {
                card.style.display = "flex";
                return;
            }

            // Verifica se o card possui pelo menos UMA das classes selecionadas
            const hasMatch = activeFilters.some(filter => card.classList.contains(filter));

            if (hasMatch) {
                card.style.display = "flex";
                card.classList.add("is-visible");
            } else {
                card.style.display = "none";
            }
        });
    }

    // Adiciona o evento de "change" em todos os checkboxes para filtrar ao clicar
    checkboxes.forEach(cb => {
        cb.addEventListener("change", applyFilters);
    });

    // ===============================================
    // 4) LÓGICA DE URL (Vindo da Home com filtro)
    // ===============================================
    const urlParams = new URLSearchParams(window.location.search);
    const filtroURL = urlParams.get('filtro'); // Captura o ?filtro=...

    if (filtroURL) {
        // Procura o checkbox que tem o value enviado pela URL
        const checkboxParaMarcar = document.querySelector(`.sidebar-filters input[value="${filtroURL}"]`);

        if (checkboxParaMarcar) {
            checkboxParaMarcar.checked = true;
        }
    }

    // Chama a função uma vez ao carregar para aplicar filtros da URL ou mostrar tudo
    applyFilters();
});