(() => {
  const root = document.documentElement;
  const themeButtons = document.querySelectorAll("[data-theme-toggle]");

  const applyTheme = (isDark) => {
    root.classList.toggle("dark", isDark);
    themeButtons.forEach((btn) => {
      btn.setAttribute("aria-pressed", String(isDark));
      const label = btn.querySelector("[data-theme-label]");
      if (label) {
        label.textContent = isDark ? "Modo claro" : "Modo oscuro";
      }
    });
  };

  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(savedTheme ? savedTheme === "dark" : prefersDark);

  themeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextDark = !root.classList.contains("dark");
      localStorage.setItem("theme", nextDark ? "dark" : "light");
      applyTheme(nextDark);
    });
  });

  const dropdownItems = document.querySelectorAll("[data-dropdown]");
  const closeAllDropdowns = () => {
    dropdownItems.forEach((item) => {
      item.classList.remove("is-open");
      const trigger = item.querySelector("[data-dropdown-trigger]");
      if (trigger) {
        trigger.setAttribute("aria-expanded", "false");
      }
    });
  };

  dropdownItems.forEach((item) => {
    const trigger = item.querySelector("[data-dropdown-trigger]");
    if (!trigger) {
      return;
    }
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = !item.classList.contains("is-open");
      closeAllDropdowns();
      if (willOpen) {
        item.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
      }
    });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-dropdown]")) {
      closeAllDropdowns();
    }
  });

  const mobileToggle = document.querySelector("[data-mobile-toggle]");
  const mobileMenu = document.querySelector("[data-mobile-menu]");

  const setMobileMenuOrigin = () => {
    if (!mobileToggle || !mobileMenu) {
      return;
    }
    const rect = mobileToggle.getBoundingClientRect();
    mobileMenu.style.setProperty("--menu-x", `${rect.left + rect.width / 2}px`);
    mobileMenu.style.setProperty("--menu-y", `${rect.top + rect.height / 2}px`);
  };

  const closeMobileMenu = () => {
    if (!mobileToggle || !mobileMenu) {
      return;
    }
    mobileMenu.classList.remove("is-open");
    mobileMenu.setAttribute("aria-hidden", "true");
    mobileToggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  };

  if (mobileToggle && mobileMenu) {
    mobileToggle.addEventListener("click", () => {
      setMobileMenuOrigin();
      const isOpen = mobileMenu.classList.toggle("is-open");
      mobileMenu.setAttribute("aria-hidden", String(!isOpen));
      mobileToggle.setAttribute("aria-expanded", String(isOpen));
      document.body.style.overflow = isOpen ? "hidden" : "";
    });

    mobileMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeMobileMenu);
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllDropdowns();
      closeMobileMenu();
    }
  });

  document.querySelectorAll(".widget-copy").forEach((button) => {
    const labelEl = button.querySelector(".widget-copy-label");
    const defaultText = labelEl ? labelEl.textContent : "Copiar";
    button.addEventListener("click", async () => {
      const textToCopy = button.getAttribute("data-copy") || "";
      if (!textToCopy) {
        return;
      }
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(textToCopy);
        } else {
          const temp = document.createElement("textarea");
          temp.value = textToCopy;
          temp.setAttribute("readonly", "");
          temp.style.position = "fixed";
          temp.style.opacity = "0";
          document.body.appendChild(temp);
          temp.select();
          document.execCommand("copy");
          document.body.removeChild(temp);
        }
        button.classList.add("is-copied");
        if (labelEl) {
          labelEl.textContent = "Copiado";
        }
        window.setTimeout(() => {
          button.classList.remove("is-copied");
          if (labelEl) {
            labelEl.textContent = defaultText;
          }
        }, 1600);
      } catch (err) {
      }
    });
  });

  const heroScenes = document.querySelectorAll("[data-hero-scene]");
  if (heroScenes.length > 0) {
    let ticking = false;
    const updateHero = () => {
      ticking = false;
      heroScenes.forEach((scene) => {
        const rect = scene.getBoundingClientRect();
        const total = Math.max(scene.offsetHeight - window.innerHeight, 1);
        const raw = Math.min(Math.max(-rect.top / total, 0), 1);
        scene.style.setProperty("--hero-progress", raw.toFixed(4));
        const words = scene.querySelectorAll(".hero-word");
        if (words.length > 0) {
          const activeCount = Math.ceil(raw * words.length);
          words.forEach((word, index) => {
            word.classList.toggle("is-active", index < activeCount || raw === 0 && index === 0);
          });
        }
      });
    };
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateHero);
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    updateHero();
  }
})();