/* AuthBlade landing page
   Minimal vanilla JavaScript. No dependencies, no build step.
   Responsibilities:
     1. Accessible mobile navigation toggle.
     2. Privacy and Terms dialogs.
     3. Current year in the footer.
   The page remains fully readable and navigable if this file fails to load:
   all content lives in index.html, and a noscript rule renders the dialogs
   as ordinary page sections when scripting is unavailable. */

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
    var desktop = window.matchMedia("(min-width: 1201px)");
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

  /* ---------- Privacy and Terms dialogs ----------
     Uses the native <dialog> element, which provides the backdrop, focus
     containment, and Escape-to-close behaviour without extra code. */

  var lastTrigger = null;

  var closeDialog = function (dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
      afterClose();
    }
  };

  var afterClose = function () {
    document.body.classList.remove("modal-open");
    if (lastTrigger && typeof lastTrigger.focus === "function") {
      lastTrigger.focus();
    }
    lastTrigger = null;
  };

  var openDialog = function (dialog, trigger) {
    if (!dialog) return false;
    lastTrigger = trigger || null;
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      // Very old browsers without dialog support: reveal it in place.
      dialog.setAttribute("open", "");
    }
    document.body.classList.add("modal-open");

    // Start reading at the top rather than wherever it was left.
    var body = dialog.querySelector(".modal-body");
    if (body) body.scrollTop = 0;

    var close = dialog.querySelector("[data-close-modal]");
    if (close && typeof close.focus === "function") close.focus();
    return true;
  };

  // Open from any link or button carrying data-modal="<dialog id>".
  document.addEventListener("click", function (event) {
    var trigger = event.target.closest && event.target.closest("[data-modal]");
    if (!trigger) return;
    var dialog = document.getElementById(trigger.getAttribute("data-modal"));
    if (dialog && openDialog(dialog, trigger)) {
      event.preventDefault();
    }
  });

  Array.prototype.forEach.call(document.querySelectorAll("dialog.doc-modal"), function (dialog) {
    // Close button and footer button.
    Array.prototype.forEach.call(dialog.querySelectorAll("[data-close-modal]"), function (btn) {
      btn.addEventListener("click", function () {
        closeDialog(dialog);
      });
    });

    // Clicking the backdrop closes. Clicks inside the panel do not.
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) {
        closeDialog(dialog);
      }
    });

    // Fires for the close button, Escape, and form dismissal alike.
    dialog.addEventListener("close", afterClose);
  });

  /* ---------- Footer year ---------- */

  var year = document.getElementById("year");
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }
})();
