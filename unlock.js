(function () {
  const modal = document.getElementById("unlock-modal");
  const trigger = document.getElementById("launch-unlock");
  const form = document.getElementById("unlock-form");
  const input = document.getElementById("unlock-passcode");
  const message = document.getElementById("unlock-message");

  if (!modal || !trigger || !form || !input) return;

  function openModal() {
    modal.hidden = false;
    document.body.classList.add("modal-open");
    input.value = "";
    if (message) {
      message.textContent = "";
      message.classList.remove("error");
    }
    window.setTimeout(() => input.focus(), 50);
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  trigger.addEventListener("click", openModal);

  modal.querySelectorAll("[data-close]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const passcode = input.value.trim();
    const button = form.querySelector('button[type="submit"]');
    const defaultLabel = button?.dataset.defaultLabel || button?.textContent || "Enter";

    if (!passcode) {
      if (message) {
        message.textContent = "Enter the passcode.";
        message.classList.add("error");
      }
      return;
    }

    if (button) {
      if (!button.dataset.defaultLabel) {
        button.dataset.defaultLabel = defaultLabel;
      }
      button.disabled = true;
      button.textContent = "Checking…";
    }

    if (message) {
      message.textContent = "";
      message.classList.remove("error");
    }

    try {
      const response = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ passcode }),
      });

      let data = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data.error || "Invalid passcode.");
      }

      window.location.href = "admin.html";
    } catch (error) {
      let errorText = error.message || "Invalid passcode.";

      if (error.message === "Failed to fetch") {
        errorText =
          "Could not reach the server. Run npm run dev for local testing, or deploy the latest site with API routes.";
      }

      if (message) {
        message.textContent = errorText;
        message.classList.add("error");
      }
      if (button) {
        button.disabled = false;
        button.textContent = button.dataset.defaultLabel;
      }
    }
  });
})();
