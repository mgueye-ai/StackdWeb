(function () {
  const forms = [
    { form: document.getElementById("waitlist-form"), message: document.getElementById("waitlist-message") },
    { form: document.getElementById("waitlist-form-bottom"), message: document.getElementById("waitlist-message-bottom") },
  ];

  forms.forEach(({ form, message }) => {
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = form.querySelector('input[type="email"]').value.trim();

      if (!email) return;

      message.textContent = "You're on the list. We'll be in touch at launch.";
      message.classList.add("success");
      form.reset();

      forms.forEach(({ message: msg }) => {
        if (msg) {
          msg.textContent = "You're on the list. We'll be in touch at launch.";
          msg.classList.add("success");
        }
      });
    });
  });

  const revealElements = document.querySelectorAll(
    ".step, .card, .mode, .split__content, .device-showcase, .product-card, .visibility-panel, .section__header"
  );

  revealElements.forEach((el) => el.classList.add("reveal"));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  revealElements.forEach((el) => observer.observe(el));

  const progressBars = document.querySelectorAll(".progress-bar__fill");
  progressBars.forEach((bar) => {
    const targetWidth = bar.style.width;
    bar.style.width = "0%";

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
})();
