(function () {
  const buttons = document.querySelectorAll(".shop-buy");

  buttons.forEach((button) => {
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
})();
