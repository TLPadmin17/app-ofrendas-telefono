// app.js
(() => {
  const $ = (id) => document.getElementById(id);

  const pillApi = $("pillApi");
  const pillAuth = $("pillAuth");
  const apiText = $("apiText");

  const loginCard = $("loginCard");
  const formCard = $("formCard");

  const loginStatus = $("loginStatus");
  const statusBox = $("statusBox");

  const username = $("username");
  const password = $("password");
  const btnLogin = $("btnLogin");
  const btnLogout = $("btnLogout");

  const fecha = $("fecha");
  const monto = $("monto");
  const motivo = $("motivo");
  const btnEnviar = $("btnEnviar");

  let currentKind = "Ofrenda";

  function apiBase() {
    const b = (window.API_BASE || "").trim().replace(/\/$/, "");
    return b;
  }

  // ✅ Ajuste: asegurar que el status SIEMPRE sea visible
  function setStatus(msg) {
    if (!statusBox) return;
    statusBox.style.display = "block";
    statusBox.textContent = msg;
  }

  function setLoginStatus(msg) { loginStatus.style.display = "block"; loginStatus.textContent = msg; }

  function tokenGet() { return localStorage.getItem("auth_token") || ""; }
  function tokenSet(t) { localStorage.setItem("auth_token", t || ""); }
  function tokenClear() { localStorage.removeItem("auth_token"); }

  function updatePills() {
    pillApi.textContent = "🌐 API: " + apiBase();
    apiText.textContent = apiBase();
    const t = tokenGet();
    pillAuth.textContent = t ? "🔒 Sesión: Activa" : "🔓 Sesión: No";
  }

  function showApp() { loginCard.style.display = "none"; formCard.style.display = "block"; setStatus("Listo. Elige Ofrenda/Diezmo/Egreso y envía."); }
  function showLogin() { loginCard.style.display = "block"; formCard.style.display = "none"; loginStatus.style.display = "none"; }

  function todayISO() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  function asIntMoney(s) {
    const digits = String(s || "").replace(/[^0-9]/g, "");
    if (!digits) return 0;
    let n = parseInt(digits, 10) || 0;
    if (n > 9999999) n = 9999999;
    return n;
  }

  async function apiLogin(user, pass) {
    const url = apiBase() + "/auth/login";
    const form = new URLSearchParams();
    form.set("username", user);
    form.set("password", pass);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString()
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.detail ? JSON.stringify(data.detail) : (data?.message || res.statusText);
      throw new Error("Login falló: " + msg);
    }
    const token = data?.access_token || "";
    if (!token) throw new Error("Login OK pero no llegó token.");
    return token;
  }

  async function apiPostMovimiento(payload) {
    const url = apiBase() + "/movimientos";
    const token = tokenGet();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.detail ? JSON.stringify(data.detail) : (data?.message || res.statusText);
      throw new Error("Error enviando: " + msg);
    }
    return data;
  }

  function buildPayload() {
    const f = (fecha.value || "").trim() || todayISO();
    const m = asIntMoney(monto.value);
    const mot = (motivo.value || "").trim();

    if (!m || m <= 0) throw new Error("Ingresa un monto mayor a 0.");
    if (currentKind === "Egreso" && !mot) throw new Error("En Egreso, escribe el motivo (obligatorio).");

    if (currentKind === "Egreso") {
      return {
        modulo: "Egreso",
        tipo: "Egreso",
        tipo_mov: "Egreso",
        fecha: f,
        monto: m,
        valor_estimado: 0,
        motivo: mot,
        adjunto_path: ""
      };
    }

    return {
      modulo: currentKind,
      tipo: "Ingreso",
      tipo_mov: "Ingreso",
      fecha: f,
      monto: m,
      valor_estimado: 0,
      motivo: mot,
      adjunto_path: ""
    };
  }

  function selectTab(kind) {
    currentKind = kind;
    document.querySelectorAll(".tab").forEach(btn => {
      const k = btn.getAttribute("data-kind");
      btn.classList.toggle("active", k === kind);
    });
    if (kind === "Egreso") {
      motivo.placeholder = "Motivo / en qué se gastó (obligatorio)";
      btnEnviar.textContent = "💸 Enviar egreso";
    } else {
      motivo.placeholder = "Ej: Ofrenda culto domingo";
      btnEnviar.textContent = "✅ Enviar";
    }
    setStatus("Listo para enviar: " + kind);
  }

  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => selectTab(btn.getAttribute("data-kind")));
  });

  btnLogin.addEventListener("click", async () => {
    try {
      setLoginStatus("Conectando…");
      const u = (username.value || "").trim();
      const p = (password.value || "").trim();
      if (!u || !p) { setLoginStatus("Escribe usuario y contraseña."); return; }
      const t = await apiLogin(u, p);
      tokenSet(t);
      updatePills();
      showApp();
    } catch (e) {
      setLoginStatus(String(e?.message || e));
      tokenClear();
      updatePills();
    }
  });

  btnLogout.addEventListener("click", () => { tokenClear(); updatePills(); showLogin(); });

  // ✅ CORRECCIÓN CLAVE: evitar submit/recarga de página + asegurar mensaje
  btnEnviar.addEventListener("click", async (e) => {
    try {
      // evita que el navegador “envíe” un form y recargue
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      if (e && typeof e.stopPropagation === "function") e.stopPropagation();

      setStatus("Enviando…");

      // evitar doble click
      try { btnEnviar.disabled = true; } catch (_) {}

      const payload = buildPayload();
      const r = await apiPostMovimiento(payload);
      const uuid = r?.uuid || r?.id || "";

      setStatus("✅ Enviado OK. " + (uuid ? ("UUID/ID: " + uuid) : ""));

      monto.value = "";
      motivo.value = "";
      monto.focus();
    } catch (e) {
      setStatus("❌ " + String(e?.message || e));
    } finally {
      try { btnEnviar.disabled = false; } catch (_) {}
    }
  });

  fecha.value = todayISO();
  updatePills();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }

  if (tokenGet()) showApp(); else showLogin();
  selectTab("Ofrenda");
})();
