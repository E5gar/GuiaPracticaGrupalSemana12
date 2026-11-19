(() => {
  const toggleBtn = document.getElementById("toggle-equipo-form");
  const equipoCard = document.getElementById("nuevo-equipo-card");
  if (toggleBtn && equipoCard) {
    toggleBtn.addEventListener("click", () => {
      equipoCard.hidden = !equipoCard.hidden;
    });
  }

  document.querySelectorAll("[data-confirm-delete]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      const msg = btn.getAttribute("data-confirm-delete") || "Confirmar eliminacion?";
      if (!window.confirm(msg)) {
        event.preventDefault();
      }
    });
  });

  document.querySelectorAll("[data-fill-login]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const email = btn.getAttribute("data-fill-login");
      const userField = document.getElementById("id_username");
      const passField = document.getElementById("id_password");
      if (userField && email) {
        userField.value = email;
      }
      if (passField) {
        passField.value = "uncp2026";
      }
    });
  });

  const params = new URLSearchParams(window.location.search);
  const equipoParam = params.get("equipo");
  const equipoSelect = document.getElementById("id_equipo");
  if (equipoParam && equipoSelect) {
    equipoSelect.value = equipoParam;
  }
})();