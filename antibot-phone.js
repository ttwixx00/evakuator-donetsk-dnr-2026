(function () {
  const COUNTER_ID = 109136230;
  const PHONE_PARTS = ["+7", "949", "499", "94", "45"];
  const MIN_WAIT_MS = 8000 + Math.floor(Math.random() * 4001);
  const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
  const BLOCK_MS = 15 * 60 * 1000;
  const MAX_ATTEMPTS = 5;
  const STORAGE_KEY = "evdn_phone_gate_v1";
  const startedAt = Date.now();
  let humanSignal = false;

  const labels = {
    wait: "\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u043f\u043e\u0434\u043e\u0436\u0434\u0438\u0442\u0435 \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u043e \u0441\u0435\u043a\u0443\u043d\u0434",
    action: "\u041f\u0440\u043e\u043a\u0440\u0443\u0442\u0438\u0442\u0435 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443 \u0438\u043b\u0438 \u0434\u0432\u0438\u0433\u0430\u0439\u0442\u0435 \u043c\u044b\u0448\u044c\u044e",
    blocked: "\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u043f\u043e\u043f\u044b\u0442\u043e\u043a. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043f\u043e\u0437\u0436\u0435",
    show: "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u043d\u043e\u043c\u0435\u0440",
    call: "\u041f\u043e\u0437\u0432\u043e\u043d\u0438\u0442\u044c"
  };

  const getPhoneRaw = () => PHONE_PARTS.join("");
  const getPhonePretty = () => `${PHONE_PARTS[0]} (${PHONE_PARTS[1]}) ${PHONE_PARTS[2]}-${PHONE_PARTS[3]}-${PHONE_PARTS[4]}`;

  const getStore = () => {
    try {
      return window.localStorage || window.sessionStorage;
    } catch (error) {
      return null;
    }
  };

  const readState = () => {
    const store = getStore();
    if (!store) {
      return { attempts: [], blockedUntil: 0 };
    }

    try {
      const parsed = JSON.parse(store.getItem(STORAGE_KEY) || "{}");
      return {
        attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
        blockedUntil: Number(parsed.blockedUntil) || 0
      };
    } catch (error) {
      return { attempts: [], blockedUntil: 0 };
    }
  };

  const writeState = (state) => {
    const store = getStore();
    if (!store) {
      return;
    }

    try {
      store.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // Storage can be unavailable in private modes; the UI should keep working.
    }
  };

  const track = (goal, params) => {
    if (typeof window.ym === "function") {
      window.ym(COUNTER_ID, "reachGoal", goal, params || {});
    }
  };

  const registerAttempt = () => {
    const now = Date.now();
    const state = readState();

    if (state.blockedUntil > now) {
      return { blocked: true, reason: "rate_block", state };
    }

    const attempts = state.attempts.filter((time) => now - time < ATTEMPT_WINDOW_MS);
    attempts.push(now);

    const nextState = { attempts, blockedUntil: 0 };
    if (attempts.length > MAX_ATTEMPTS) {
      nextState.blockedUntil = now + BLOCK_MS;
      writeState(nextState);
      return { blocked: true, reason: "too_many_attempts", state: nextState };
    }

    writeState(nextState);
    return { blocked: false, reason: "", state: nextState };
  };

  const isPhoneGate = (target) => Boolean(target && target.closest && target.closest("[data-phone-gate]"));

  const markHuman = (event) => {
    if (event && isPhoneGate(event.target)) {
      return;
    }
    humanSignal = true;
  };

  ["scroll", "mousemove", "touchstart", "pointermove", "keydown"].forEach((eventName) => {
    window.addEventListener(eventName, markHuman, { passive: true, once: true });
  });

  document.addEventListener("click", markHuman, { capture: true, passive: true });

  const setMessage = (button, message) => {
    let status = button.querySelector(".phone-gate-status");
    if (!status) {
      status = document.createElement("span");
      status.className = "phone-gate-status";
      status.setAttribute("aria-live", "polite");
      button.appendChild(status);
    }
    status.textContent = message;
  };

  const revealAndCall = (button) => {
    const phone = getPhoneRaw();
    const prettyPhone = getPhonePretty();

    button.classList.add("is-revealed");
    button.setAttribute("aria-label", `${labels.call}: ${prettyPhone}`);
    button.innerHTML = `<span class="phone-gate-number">${prettyPhone}</span>`;

    track("phone_click", {
      phone,
      page: window.location.pathname,
      button: button.dataset.phoneLabel || button.textContent.trim()
    });

    window.location.href = `tel:${phone}`;
  };

  const handlePhoneClick = (event) => {
    const button = event.currentTarget;
    event.preventDefault();

    const attempt = registerAttempt();
    if (attempt.blocked) {
      button.classList.add("is-blocked");
      setMessage(button, labels.blocked);
      track("antibot_phone_blocked", {
        reason: attempt.reason,
        page: window.location.pathname
      });
      return;
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_WAIT_MS) {
      setMessage(button, labels.wait);
      track("antibot_phone_blocked", {
        reason: "too_fast",
        elapsed,
        page: window.location.pathname
      });
      return;
    }

    if (!humanSignal) {
      setMessage(button, labels.action);
      track("antibot_phone_blocked", {
        reason: "no_human_signal",
        elapsed,
        page: window.location.pathname
      });
      return;
    }

    revealAndCall(button);
  };

  document.querySelectorAll("[data-phone-gate]").forEach((button) => {
    button.addEventListener("click", handlePhoneClick);
  });
})();
