(function () {
  async function requireLaunchAccess() {
    try {
      const response = await fetch("/api/check-launch-access", { credentials: "include" });
      const data = await response.json();
      if (!data.ok) {
        window.location.replace("index.html");
        return false;
      }
      return true;
    } catch {
      window.location.replace("index.html");
      return false;
    }
  }

  function initShopButtons() {
    document.querySelectorAll(".shop-buy").forEach((button) => {
      button.addEventListener("click", async () => {
        const product = button.dataset.product;
        const card = button.closest(".shop-card");
        const note = card?.querySelector(".shop-card__note");
        const defaultLabel = button.textContent;

        if (!product) return;

        button.disabled = true;
        button.textContent = "Redirecting…";
        if (note) {
          note.textContent = "";
          note.classList.remove("error");
        }

        try {
          const response = await fetch("/api/create-checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product }),
          });

          const data = await response.json();

          if (!response.ok || !data.url) {
            throw new Error(data.error || "Could not start checkout.");
          }

          window.location.href = data.url;
        } catch (error) {
          button.disabled = false;
          button.textContent = defaultLabel;
          if (note) {
            note.textContent = error.message || "Checkout failed. Please try again.";
            note.classList.add("error");
          }
        }
      });
    });
  }

  function initHeader() {
    const header = document.getElementById("header");
    if (!header) return;

    const onScroll = () => {
      header.classList.toggle("header--scrolled", window.scrollY > 12);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function initWaitlist() {
    const form = document.getElementById("waitlist-form-launch");
    const message = document.getElementById("waitlist-message-launch");
    if (!form) return;

    const SUCCESS_DEFAULT = "You're on the list. We'll be in touch.";
    const ERROR_DEFAULT = "Could not join the list. Please try again.";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const emailInput = form.querySelector('input[type="email"]');
      const honeypot = form.querySelector('input[name="website"]');
      const email = emailInput ? emailInput.value.trim() : "";
      const button = form.querySelector('button[type="submit"]');

      if (!email) {
        if (message) {
          message.textContent = "Please enter a valid email address.";
          message.classList.add("error");
        }
        return;
      }

      if (button) {
        if (!button.dataset.defaultLabel) {
          button.dataset.defaultLabel = button.textContent;
        }
        button.disabled = true;
        button.textContent = "Joining…";
      }

      if (message) {
        message.textContent = "";
        message.classList.remove("error", "success");
      }

      try {
        const response = await fetch("/api/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            source: "launch",
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

        form.reset();
        if (message) {
          message.textContent = data.message || SUCCESS_DEFAULT;
          message.classList.add("success");
        }
      } catch (error) {
        if (message) {
          message.textContent = error.message || ERROR_DEFAULT;
          message.classList.add("error");
        }
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = button.dataset.defaultLabel;
        }
      }
    });
  }

  function initReveal() {
    const revealSelectors = [
      ".launch-step",
      ".launch-goal",
      ".launch-device-intro__copy",
      ".launch-dashboard",
      ".launch-compare__col",
      ".section__header",
      ".launch-app__copy",
      ".launch-app__visual",
      ".ecosystem",
      ".launch-include",
      ".shop-card",
      ".launch-proof-stat",
      ".launch-quote",
      ".launch-reason",
      ".faq-item",
      ".cta",
      ".launch-hero__center",
      ".launch-hero__banner",
    ];

    const revealElements = document.querySelectorAll(revealSelectors.join(", "));
    revealElements.forEach((el) => el.classList.add("reveal"));

    document.querySelectorAll(".launch-steps .launch-step, .launch-goals .launch-goal").forEach((el, i) => {
      el.classList.add(`reveal--delay-${(i % 3) + 1}`);
    });

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      revealElements.forEach((el) => el.classList.add("visible"));
      return;
    }

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
  }

  function initProgressBars() {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    document.querySelectorAll(".progress-bar__fill").forEach((bar) => {
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
  }

  function initCarousels() {
    const carouselMq = window.matchMedia("(max-width: 900px)");

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

  requireLaunchAccess().then((allowed) => {
    if (!allowed) return;
    initHeader();
    initReveal();
    initProgressBars();
    initCarousels();
    initShopButtons();
    initWaitlist();
  });
})();
