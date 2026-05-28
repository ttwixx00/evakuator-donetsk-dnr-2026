(function () {
  const COUNTER_ID = 109136230;
  const PHONE_PARTS = ["+7", "949", "499", "94", "45"];
  const PAGE_MIN_WAIT_MS = 1500 + Math.floor(Math.random() * 1001);
  const REVEAL_DELAY_MS = 3200 + Math.floor(Math.random() * 1001);
  const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
  const BLOCK_MS = 15 * 60 * 1000;
  const MAX_ATTEMPTS = 5;
  const STORAGE_KEY = "evdn_phone_gate_v2";
  const startedAt = Date.now();
  let humanSignal = false;

  const labels = {
    wait: "\u041d\u043e\u043c\u0435\u0440 \u043e\u0442\u043a\u0440\u043e\u0435\u0442\u0441\u044f",
    pending: "\u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u043c \u043d\u043e\u043c\u0435\u0440",
    blocked: "\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u043f\u043e\u043f\u044b\u0442\u043e\u043a. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043f\u043e\u0437\u0436\u0435",
    action: "\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u043f\u043e\u0434\u043e\u0436\u0434\u0438\u0442\u0435 \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u043e \u0441\u0435\u043a\u0443\u043d\u0434",
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
    if (event && event.isTrusted === false) {
      return;
    }

    humanSignal = true;
  };

  ["scroll", "mousemove", "touchstart", "pointermove", "pointerdown", "keydown"].forEach((eventName) => {
    window.addEventListener(eventName, markHuman, { passive: true, once: true });
  });

  document.addEventListener("click", (event) => {
    if (!isPhoneGate(event.target)) {
      markHuman(event);
    }
  }, { capture: true, passive: true });

  const getTextNode = (button) => Array.from(button.childNodes).find((node) => (
    node.nodeType === window.Node.TEXT_NODE && node.textContent.trim()
  ));

  const setButtonLabel = (button, label) => {
    const textNode = getTextNode(button);
    if (textNode) {
      textNode.textContent = label;
      return;
    }

    button.insertBefore(document.createTextNode(label), button.firstChild);
  };

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

  const revealButton = (button, phone, prettyPhone) => {
    button.classList.remove("is-pending", "is-blocked");
    button.classList.add("is-revealed");
    button.removeAttribute("aria-busy");
    button.setAttribute("aria-label", `${labels.call}: ${prettyPhone}`);
    button.innerHTML = `<span class="phone-gate-number">${prettyPhone}</span>`;
    button.dataset.phoneRevealed = "true";
  };

  const revealAll = () => {
    const phone = getPhoneRaw();
    const prettyPhone = getPhonePretty();

    document.querySelectorAll("[data-phone-gate]").forEach((button) => {
      revealButton(button, phone, prettyPhone);
    });

    return { phone, prettyPhone };
  };

  const completePhoneAction = (button, shouldDial) => {
    const { phone } = revealAll();

    track("phone_click", {
      phone,
      page: window.location.pathname,
      button: button.dataset.phoneLabel || button.textContent.trim()
    });

    if (shouldDial) {
      window.location.href = `tel:${phone}`;
    }
  };

  const scheduleReveal = (button, delay) => {
    const safeDelay = Math.max(1800, delay);
    const endsAt = Date.now() + safeDelay;

    button.dataset.phonePending = "true";
    button.classList.add("is-pending");
    button.setAttribute("aria-busy", "true");
    setButtonLabel(button, labels.pending);

    const renderCountdown = () => {
      const secondsLeft = Math.max(1, Math.ceil((endsAt - Date.now()) / 1000));
      setMessage(button, `${labels.wait} \u0447\u0435\u0440\u0435\u0437 ${secondsLeft} \u0441\u0435\u043a.`);
    };

    renderCountdown();
    const intervalId = window.setInterval(renderCountdown, 250);

    window.setTimeout(() => {
      window.clearInterval(intervalId);
      button.dataset.phonePending = "";
      completePhoneAction(button, button.dataset.phoneLabel !== "show");
    }, safeDelay);
  };

  const blockAttempt = (button, reason, params) => {
    button.classList.add("is-blocked");
    setMessage(button, reason === "no_human_signal" ? labels.action : labels.blocked);
    track("antibot_phone_blocked", {
      reason,
      page: window.location.pathname,
      ...(params || {})
    });
  };

  const handlePhoneClick = (event) => {
    const button = event.currentTarget;
    event.preventDefault();

    if (button.dataset.phoneRevealed === "true") {
      completePhoneAction(button, true);
      return;
    }

    if (button.dataset.phonePending === "true") {
      setMessage(button, "\u0423\u0436\u0435 \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u043c, \u043f\u043e\u0434\u043e\u0436\u0434\u0438\u0442\u0435");
      return;
    }

    if (event.isTrusted !== false) {
      humanSignal = true;
    }

    if (!humanSignal) {
      blockAttempt(button, "no_human_signal");
      return;
    }

    const attempt = registerAttempt();
    if (attempt.blocked) {
      blockAttempt(button, attempt.reason);
      return;
    }

    const elapsed = Date.now() - startedAt;
    const delay = Math.max(REVEAL_DELAY_MS, PAGE_MIN_WAIT_MS - elapsed);
    scheduleReveal(button, delay);
  };

  document.querySelectorAll("[data-phone-gate]").forEach((button) => {
    button.addEventListener("click", handlePhoneClick);
  });
})();
