/* AuthBlade landing page
   Minimal vanilla JavaScript. No dependencies, no build step.
   Responsibilities:
     1. Accessible mobile navigation toggle.
     2. Current year in the footer.
   The page remains fully readable and navigable if this file fails to load. */

(function () {
  "use strict";

  /* ---------- Mobile navigation ---------- */

  var toggle = document.getElementById("navToggle");
  var nav = document.getElementById("primaryNav");

  if (toggle && nav) {
    var setOpen = function (open) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    };

    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    // Close after choosing a destination on small screens.
    nav.addEventListener("click", function (event) {
      var target = event.target;
      if (target && target.closest && target.closest("a")) {
        setOpen(false);
      }
    });

    // Escape closes the menu and returns focus to the toggle.
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });

    // Reset state when the layout returns to the desktop navigation.
    var desktop = window.matchMedia("(min-width: 1081px)");
    var onChange = function (event) {
      if (event.matches) {
        setOpen(false);
      }
    };
    if (typeof desktop.addEventListener === "function") {
      desktop.addEventListener("change", onChange);
    } else if (typeof desktop.addListener === "function") {
      desktop.addListener(onChange);
    }
  }

  /* ---------- Footer year ---------- */

  var year = document.getElementById("year");
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }
})();
