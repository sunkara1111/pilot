/**
 * Shared chrome for Pilot tool pages: year, nav, service worker, meter, copy, install.
 */
(function (global) {
  "use strict";

  function initChrome(swPath) {
    document.querySelectorAll(".y").forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
    var btn = document.getElementById("nav-toggle");
    var panel = document.getElementById("mobile-nav");
    if (btn && panel) {
      btn.addEventListener("click", function () {
        var open = panel.classList.toggle("open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register(swPath || "../sw.js").catch(function () {});
      });
    }
  }

  function copyText(text, statusEl) {
    function ok() {
      if (statusEl) statusEl.textContent = "Copied to clipboard.";
      setTimeout(function () {
        if (statusEl) statusEl.textContent = "";
      }, 2200);
    }
    function fallback() {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "readonly");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        var copiedByCommand = document.execCommand("copy");
        document.body.removeChild(ta);
        if (copiedByCommand) ok();
        else if (statusEl) statusEl.textContent = "Select the text and copy it manually.";
      } catch (error) {
        if (statusEl) statusEl.textContent = "Select the text and copy it manually.";
      }
    }
    if (!text) {
      if (statusEl) statusEl.textContent = "Generate a result first.";
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok).catch(fallback);
    } else {
      fallback();
    }
  }

  function bindMeter(composer, usesLeft, meterFill, limitBanner, genBtn) {
    function update(generating) {
      var left = composer.remaining();
      if (usesLeft) usesLeft.textContent = String(left);
      if (meterFill) {
        var pct = Math.max(0, Math.min(100, Math.round((left / composer.dailyLimit) * 100)));
        meterFill.style.width = pct + "%";
      }
      if (limitBanner) {
        if (left <= 0) limitBanner.classList.remove("hidden");
        else limitBanner.classList.add("hidden");
      }
      if (genBtn) {
        genBtn.disabled = left <= 0 || !!generating;
      }
    }
    update(false);
    return update;
  }

  function bindInstall() {
    var deferredPrompt = null;
    var installBtn = document.getElementById("btn-install");
    var installStatus = document.getElementById("install-status");
    if (!installBtn) return;
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      installBtn.classList.remove("hidden");
    });
    installBtn.addEventListener("click", function () {
      if (!deferredPrompt) {
        if (installStatus) {
          installStatus.textContent = "Use your browser’s Add to Home Screen / Install option. Pilot is a free web app — not on App Store or Play Store.";
        }
        return;
      }
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
        installBtn.classList.add("hidden");
        if (installStatus) installStatus.textContent = "If installed, you’ll find Pilot on your home screen.";
      });
    });
    window.addEventListener("appinstalled", function () {
      if (installStatus) installStatus.textContent = "Added to your device as a free web app.";
      installBtn.classList.add("hidden");
    });
  }

  global.PilotPage = {
    initChrome: initChrome,
    copyText: copyText,
    bindMeter: bindMeter,
    bindInstall: bindInstall
  };
})(typeof window !== "undefined" ? window : globalThis);
