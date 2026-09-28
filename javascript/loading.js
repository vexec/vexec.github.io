(function () {
  const loader = document.getElementById("page-loader");
  if (!loader) return;

  const MIN_DISPLAY = 400;
  let startedAt = 0;
  let hideTimeout = null;
  let isActive = false;

  function show() {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
    if (!isActive) {
      startedAt = Date.now();
      isActive = true;
    }
    loader.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function hide() {
    isActive = false;
    const elapsed = Date.now() - startedAt;
    const delay = Math.max(0, MIN_DISPLAY - elapsed);

    if (hideTimeout) clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      if (isActive) return;
      loader.classList.add("hidden");
      document.body.style.overflow = "";
      hideTimeout = null;
    }, delay);
  }

  document.addEventListener("loading:start", show);
  document.addEventListener("loading:end", hide);

  show();

  window.addEventListener("load", () => {
    setTimeout(() => {
      if (!isActive) hide();
    }, 100);
  });
})();