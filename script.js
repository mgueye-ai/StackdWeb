(function () {
  const forms = [
    { form: document.getElementById("waitlist-form"), message: document.getElementById("waitlist-message"), source: "hero" },
    { form: document.getElementById("waitlist-form-bottom"), message: document.getElementById("waitlist-message-bottom"), source: "cta" },
  ];

  const SUCCESS_DEFAULT = "You're on the list. We'll be in touch at launch.";
  const ERROR_DEFAULT = "Could not join the waitlist. Please try again.";

  function setFormMessage(messageEl, text, type) {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.classList.remove("success", "error");
    if (type) messageEl.classList.add(type);
  }

  function setFormLoading(form, isLoading) {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;

    if (isLoading) {
      if (!button.dataset.defaultLabel) {
        button.dataset.defaultLabel = button.textContent;
      }
      button.disabled = true;
      button.textContent = "Joining…";
      form.setAttribute("aria-busy", "true");
      return;
    }

    button.disabled = false;
    button.textContent = button.dataset.defaultLabel || button.textContent;
    form.removeAttribute("aria-busy");
  }

  async function submitWaitlist(form, source) {
    const emailInput = form.querySelector('input[type="email"]');
    const honeypot = form.querySelector('input[name="website"]');
    const email = emailInput ? emailInput.value.trim() : "";

    if (!email) return null;

    const response = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        source,
        website: honeypot ? honeypot.value : "",
      }),
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(data.error || ERROR_DEFAULT);
    }

    return data.message || SUCCESS_DEFAULT;
  }

  forms.forEach(({ form, message, source }) => {
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const emailInput = form.querySelector('input[type="email"]');
      const email = emailInput ? emailInput.value.trim() : "";

      if (!email) {
        setFormMessage(message, "Please enter a valid email address.", "error");
        return;
      }

      forms.forEach(({ message: msg }) => setFormMessage(msg, "", null));
      setFormLoading(form, true);

      try {
        const successMessage = await submitWaitlist(form, source);
        form.reset();

        forms.forEach(({ message: msg }) => {
          setFormMessage(msg, successMessage, "success");
        });
      } catch (error) {
        setFormMessage(message, error.message || ERROR_DEFAULT, "error");
      } finally {
        setFormLoading(form, false);
      }
    });
  });

  const header = document.getElementById("header");
  if (header) {
    const onScroll = () => {
      header.classList.toggle("header--scrolled", window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  const revealSelectors = [
    ".step",
    ".mode",
    ".split__content",
    ".device-showcase",
    ".product-card",
    ".visibility-panel",
    ".section__header",
    ".card",
    ".app-section__intro",
    ".app-preview",
    ".ecosystem",
    ".tagline blockquote",
    ".cta",
  ];

  const revealElements = document.querySelectorAll(revealSelectors.join(", "));

  revealElements.forEach((el) => el.classList.add("reveal"));

  document.querySelectorAll(".steps .step, .modes .mode, .cards .card, .hero__products .product-card").forEach((el, i) => {
    el.classList.add(`reveal--delay-${(i % 3) + 1}`);
  });

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!prefersReducedMotion) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -32px 0px" }
    );

    revealElements.forEach((el) => observer.observe(el));
  } else {
    revealElements.forEach((el) => el.classList.add("visible"));
  }

  const progressBars = document.querySelectorAll(".progress-bar__fill");
  progressBars.forEach((bar) => {
    const targetWidth = bar.style.width;
    bar.style.width = "0%";

    if (prefersReducedMotion) {
      bar.style.width = targetWidth;
      return;
    }

    const barObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            bar.style.transition = "width 1.4s cubic-bezier(0.22, 1, 0.36, 1)";
            bar.style.width = targetWidth;
            barObserver.unobserve(bar);
          }
        });
      },
      { threshold: 0.5 }
    );

    barObserver.observe(bar.closest(".progress-bar"));
  });

  const carouselMq = window.matchMedia("(max-width: 900px)");

  function initCarousels() {
    document.querySelectorAll(".carousel").forEach((carousel) => {
      const track = carousel.querySelector(".carousel__track");
      const dotsEl = carousel.querySelector(".carousel__dots");
      if (!track || !dotsEl) return;

      const slides = () => [...track.children];

      function getActiveIndex() {
        const items = slides();
        if (!items.length) return 0;

        const trackRect = track.getBoundingClientRect();
        const trackCenter = trackRect.left + trackRect.width / 2;

        let closest = 0;
        let closestDistance = Infinity;

        items.forEach((slide, index) => {
          const rect = slide.getBoundingClientRect();
          const slideCenter = rect.left + rect.width / 2;
          const distance = Math.abs(slideCenter - trackCenter);
          if (distance < closestDistance) {
            closestDistance = distance;
            closest = index;
          }
        });

        return closest;
      }

      function updateDots() {
        const index = getActiveIndex();
        dotsEl.querySelectorAll(".carousel__dot").forEach((dot, i) => {
          dot.classList.toggle("is-active", i === index);
          dot.setAttribute("aria-selected", i === index ? "true" : "false");
        });
      }

      function buildDots() {
        const items = slides();
        dotsEl.innerHTML = "";

        if (!carouselMq.matches || items.length <= 1) {
          dotsEl.setAttribute("aria-hidden", "true");
          return;
        }

        dotsEl.setAttribute("aria-hidden", "false");
        dotsEl.setAttribute("role", "tablist");

        items.forEach((_, i) => {
          const dot = document.createElement("button");
          dot.type = "button";
          dot.className = `carousel__dot${i === 0 ? " is-active" : ""}`;
          dot.setAttribute("role", "tab");
          dot.setAttribute("aria-label", `Slide ${i + 1} of ${items.length}`);
          dot.setAttribute("aria-selected", i === 0 ? "true" : "false");
          dot.addEventListener("click", () => {
            items[i].scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
          });
          dotsEl.appendChild(dot);
        });

        updateDots();
      }

      buildDots();
      carouselMq.addEventListener("change", buildDots);

      let scrollTimer;
      track.addEventListener(
        "scroll",
        () => {
          window.clearTimeout(scrollTimer);
          scrollTimer = window.setTimeout(updateDots, 60);
        },
        { passive: true }
      );
    });
  }

  initCarousels();
})();
