(function () {
  const MODEL_URL = "DeepSeek/viewer.model3.json";
  const PRELOAD = [
    "DeepSeek/大肥鱼.moc3",
    "DeepSeek/大肥鱼.physics3.json",
    "DeepSeek/大肥鱼.4096/texture_00.png",
    "DeepSeek/大肥鱼.4096/texture_01.png",
    "DeepSeek/大肥鱼.4096/texture_02.png",
    "DeepSeek/大肥鱼.4096/texture_03.png",
    "DeepSeek/大肥鱼.4096/texture_04.png"
  ];
  const HAND = {
    raise: ["ToRaise", 1133],
    foxtail: ["ToFoxtail", 1233],
    finger: ["ToFinger", 1250]
  };
  const RETURN = {
    raise: ["FromRaise", 1017],
    foxtail: ["FromFoxtail", 1133],
    finger: ["FromFinger", 1250]
  };
  const EYES = {
    normal: { key3: 0, key4: 0, key5: 0, key6: 0 },
    spiral: { key3: 1, key4: 0, key5: 0, key6: 0 },
    heart: { key3: 0, key4: 1, key5: 0, key6: 0 },
    tight: { key3: 0, key4: 0, key5: 1, key6: 0 },
    smug: { key3: 0, key4: 0, key5: 0, key6: 1 }
  };
  const SCENE_LABEL = { idle: "待机", lost: "脱捕" };
  const HAND_LABEL = { default: "默认手", raise: "举手", foxtail: "狗尾草", finger: "竖食指" };
  const ZOOM_MIN = 0.7;
  const ZOOM_MAX = 8;

  const state = {
    scene: "idle",
    hand: "default",
    eye: "normal",
    head: "none",
    body: 0,
    tears: false,
    dark: false,
    blush: false,
    sweat: false,
    tooth: false,
    loading: false,
    skirt: false,
    chest: false,
    shoes: false,
    tail: false,
    lean: false
  };

  const view = { zoom: 1, panX: 0, panY: 0 };
  let app = null;
  let model = null;
  let params = {};
  let seq = 0;
  let startedAt = performance.now();

  const boot = document.getElementById("boot");
  const bootText = document.getElementById("bootText");
  const bootBar = document.getElementById("bootBar");
  const bootPct = document.getElementById("bootPct");
  const statusEl = document.getElementById("status");
  const zoomLabel = document.getElementById("zoomLabel");
  const zoomSlider = document.getElementById("zoomSlider");

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setBoot(ratio, text) {
    const pct = Math.round(clamp(ratio, 0, 1) * 100);
    bootBar.style.width = pct + "%";
    bootPct.textContent = pct + "%";
    if (text) bootText.textContent = text;
  }

  function fail(message) {
    bootText.textContent = message;
    bootPct.textContent = "";
    boot.classList.remove("is-done");
  }

  function preload() {
    const sizes = PRELOAD.map(function () { return 0; });
    const loaded = PRELOAD.map(function () { return 0; });
    function paint() {
      const total = sizes.reduce(function (sum, n) { return sum + n; }, 0);
      const done = loaded.reduce(function (sum, n) { return sum + n; }, 0);
      if (total > 0) setBoot(done / total);
    }
    return Promise.all(PRELOAD.map(function (url, index) {
      return new Promise(function (resolve, reject) {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        xhr.responseType = "blob";
        xhr.onprogress = function (event) {
          if (event.lengthComputable) {
            sizes[index] = event.total;
            loaded[index] = event.loaded;
            paint();
          }
        };
        xhr.onload = function () {
          if (xhr.status === 200 || xhr.status === 0) {
            loaded[index] = sizes[index] || loaded[index];
            paint();
            resolve();
          } else {
            reject(new Error(url));
          }
        };
        xhr.onerror = function () { reject(new Error(url)); };
        xhr.send();
      });
    }));
  }

  function captureParams(core) {
    params = {};
    const ids = core._parameterIds;
    for (let i = 0; i < ids.length; i++) {
      params[ids[i]] = {
        index: i,
        def: core._model.parameters.defaultValues[i],
        min: core._model.parameters.minimumValues[i],
        max: core._model.parameters.maximumValues[i]
      };
    }
  }

  function setDelta(core, id, delta) {
    const item = params[id];
    if (!item) return;
    core.setParameterValueByIndex(item.index, clamp(item.def + delta, item.min, item.max));
  }

  function blinkAmount(now) {
    const period = 3.6 + Math.sin(now * 0.21) * 0.45;
    const phase = (now % period) / period;
    if (phase < 0.9) return 1;
    const k = (phase - 0.9) / 0.1;
    return 1 - Math.sin(k * Math.PI);
  }

  function applyLook() {
    const internal = model.internalModel;
    const core = internal.coreModel;
    const eyes = EYES[state.eye];
    const allowLostFace = state.scene === "lost" && state.eye === "normal";
    if (!allowLostFace) {
      setDelta(core, "key3", eyes.key3);
      setDelta(core, "key4", eyes.key4);
      setDelta(core, "key5", eyes.key5);
      setDelta(core, "key6", eyes.key6);
    }
    setDelta(core, "key1", state.dark ? 1 : 0);
    setDelta(core, "key2", state.tears ? 1 : 0);
    setDelta(core, "key7", state.blush ? 1 : 0);
    if (!(state.scene === "lost" && !state.loading)) setDelta(core, "key8", state.loading ? 1 : 0);
    setDelta(core, "key9", state.tooth ? 1 : 0);
    setDelta(core, "key13", state.sweat ? 1 : 0);
    setDelta(core, "key10", state.head === "basin" ? 1 : 0);
    setDelta(core, "key11", state.head === "glasses" ? 1 : 0);
    setDelta(core, "key12", state.head === "monocle" ? 1 : 0);
    setDelta(core, "Clothes1", state.skirt ? -1 : 0);
    setDelta(core, "Clothes2", state.body);
    setDelta(core, "Clothes3", state.chest ? 1 : 0);
    setDelta(core, "Clothes4", state.shoes ? 1 : 0);
    setDelta(core, "Clothes5", state.tail ? -1 : 0);
    setDelta(core, "LeanInput", state.lean ? -30 : 0);

    const blink = blinkAmount((performance.now() - startedAt) / 1000);
    if (blink < 0.985 && params.ParamEyeLOpen) {
      core.multiplyParameterValueById("ParamEyeLOpen", blink);
      core.multiplyParameterValueById("ParamEyeROpen", blink);
    }

    if (state.scene !== "lost") {
      const focus = internal.focusController;
      if (params.AngleX) core.addParameterValueById("AngleX", focus.x * 30);
      if (params.AngleY) core.addParameterValueById("AngleY", focus.y * 30);
      if (params.AngleZ) core.addParameterValueById("AngleZ", focus.x * focus.y * -30);
    }
  }

  function insets() {
    const narrow = window.matchMedia("(max-width: 860px)").matches;
    if (narrow) return { left: 18, right: 18, top: 88, bottom: 156 };
    return { left: 36, right: 400, top: 96, bottom: 132 };
  }

  function metrics() {
    const box = insets();
    const width = app.screen.width;
    const height = app.screen.height;
    const availW = Math.max(120, width - box.left - box.right);
    const availH = Math.max(120, height - box.top - box.bottom);
    const modelW = model.internalModel.width;
    const modelH = model.internalModel.height;
    const fit = Math.min(availW / modelW, availH / modelH) * 0.96;
    return { box: box, width: width, height: height, availW: availW, availH: availH, modelW: modelW, modelH: modelH, fit: fit };
  }

  function layout() {
    if (!model) return;
    const m = metrics();
    const scale = m.fit * view.zoom;
    model.scale.set(scale);
    model.position.set(
      m.box.left + (m.availW - m.modelW * scale) / 2 + view.panX,
      m.box.top + (m.availH - m.modelH * scale) / 2 + view.panY
    );
  }

  function syncZoom() {
    const pct = Math.round(view.zoom * 100);
    zoomLabel.textContent = pct + "%";
    zoomSlider.value = String(clamp(pct, 70, 800));
  }

  function zoomToward(x, y, next) {
    next = clamp(next, ZOOM_MIN, ZOOM_MAX);
    const m = metrics();
    const oldScale = m.fit * view.zoom;
    const newScale = m.fit * next;
    const localX = (x - model.x) / oldScale;
    const localY = (y - model.y) / oldScale;
    view.zoom = next;
    view.panX = (x - localX * newScale) - (m.box.left + (m.availW - m.modelW * newScale) / 2);
    view.panY = (y - localY * newScale) - (m.box.top + (m.availH - m.modelH * newScale) / 2);
    layout();
    syncZoom();
  }

  function frame(zoom, anchorY) {
    view.zoom = clamp(zoom, ZOOM_MIN, ZOOM_MAX);
    view.panX = 0;
    const m = metrics();
    const scale = m.fit * view.zoom;
    const naturalY = m.box.top + (m.availH - m.modelH * scale) / 2;
    const desired = m.box.top + m.availH * 0.42 - anchorY * m.modelH * scale;
    view.panY = zoom === 1 ? 0 : desired - naturalY;
    layout();
    syncZoom();
    markFrame();
  }

  function markFrame() {
    document.querySelectorAll("[data-frame]").forEach(function (button) {
      button.setAttribute("aria-pressed", "false");
    });
  }

  function renderStatus() {
    statusEl.textContent = SCENE_LABEL[state.scene] + " · " + HAND_LABEL[state.hand];
    document.querySelectorAll("[data-scene]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.scene === state.scene));
    });
    document.querySelectorAll("[data-hand]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.hand === state.hand));
    });
    document.querySelectorAll("[data-eye]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.eye === state.eye));
    });
    document.querySelectorAll("[data-head]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.head === state.head));
    });
    document.querySelectorAll("[data-body]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(Number(button.dataset.body) === state.body));
    });
    document.querySelectorAll("[data-toggle]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(!!state[button.dataset.toggle]));
    });
  }

  function cancelled() {
    const error = new Error("cancelled");
    error.name = "Cancelled";
    return error;
  }

  async function play(group, ms, token) {
    await model.motion(group, 0, PIXI.live2d.MotionPriority.FORCE);
    await wait(ms);
    if (seq !== token) throw cancelled();
  }

  async function setHand(next) {
    if (next === state.hand) return;
    const token = ++seq;
    const previous = state.hand;
    state.hand = next;
    state.scene = "idle";
    renderStatus();
    try {
      if (previous !== "default") await play(RETURN[previous][0], RETURN[previous][1] + 60, token);
      if (next !== "default") await play(HAND[next][0], HAND[next][1] + 60, token);
      if (seq !== token) return;
      await model.motion("Idle", 0, PIXI.live2d.MotionPriority.FORCE);
    } catch (error) {
      if (error.name !== "Cancelled") console.error(error);
    }
  }

  async function setScene(next) {
    if (next === state.scene && state.hand === "default") {
      await model.motion(next === "lost" ? "Lost" : "Idle", 0, PIXI.live2d.MotionPriority.FORCE);
      return;
    }
    const token = ++seq;
    const previousHand = state.hand;
    state.scene = next;
    state.hand = "default";
    renderStatus();
    try {
      if (previousHand !== "default") await play(RETURN[previousHand][0], RETURN[previousHand][1] + 60, token);
      if (seq !== token) return;
      await model.motion(next === "lost" ? "Lost" : "Idle", 0, PIXI.live2d.MotionPriority.FORCE);
    } catch (error) {
      if (error.name !== "Cancelled") console.error(error);
    }
  }

  function resetLook() {
    state.eye = "normal";
    state.head = "none";
    state.body = 0;
    ["tears", "dark", "blush", "sweat", "tooth", "loading", "skirt", "chest", "shoes", "tail", "lean"].forEach(function (key) {
      state[key] = false;
    });
    renderStatus();
  }

  function bindControls() {
    document.getElementById("sceneGroup").addEventListener("click", function (event) {
      const button = event.target.closest("[data-scene]");
      if (button) setScene(button.dataset.scene);
    });
    document.getElementById("handGroup").addEventListener("click", function (event) {
      const button = event.target.closest("[data-hand]");
      if (button) setHand(button.dataset.hand);
    });
    document.getElementById("eyeGroup").addEventListener("click", function (event) {
      const button = event.target.closest("[data-eye]");
      if (!button) return;
      state.eye = button.dataset.eye;
      renderStatus();
    });
    document.getElementById("headGroup").addEventListener("click", function (event) {
      const button = event.target.closest("[data-head]");
      if (!button) return;
      state.head = button.dataset.head;
      renderStatus();
    });
    document.getElementById("bodyGroup").addEventListener("click", function (event) {
      const button = event.target.closest("[data-body]");
      if (!button) return;
      state.body = Number(button.dataset.body);
      renderStatus();
    });
    document.querySelectorAll("[data-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        const key = button.dataset.toggle;
        state[key] = !state[key];
        renderStatus();
      });
    });
    document.getElementById("resetLook").addEventListener("click", resetLook);

    document.getElementById("zoomIn").addEventListener("click", function () {
      const m = metrics();
      zoomToward(m.box.left + m.availW / 2, m.box.top + m.availH / 2, view.zoom * 1.22);
      markFrame();
    });
    document.getElementById("zoomOut").addEventListener("click", function () {
      const m = metrics();
      zoomToward(m.box.left + m.availW / 2, m.box.top + m.availH / 2, view.zoom / 1.22);
      markFrame();
    });
    zoomSlider.addEventListener("input", function () {
      const m = metrics();
      zoomToward(m.box.left + m.availW / 2, m.box.top + m.availH / 2, Number(zoomSlider.value) / 100);
      markFrame();
    });
    document.querySelectorAll("[data-frame]").forEach(function (button) {
      button.addEventListener("click", function () {
        const kind = button.dataset.frame;
        if (kind === "full") frame(1, 0.5);
        if (kind === "bust") frame(1.85, 0.24);
        if (kind === "face") frame(3.15, 0.15);
        if (kind === "eyes") frame(5.4, 0.125);
        document.querySelectorAll("[data-frame]").forEach(function (item) {
          item.setAttribute("aria-pressed", String(item === button));
        });
      });
    });
    document.getElementById("resetView").addEventListener("click", function () { frame(1, 0.5); });

    const toggle = document.getElementById("panelToggle");
    toggle.addEventListener("click", function () {
      const open = document.body.classList.toggle("panel-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "收起面板" : "动作与装扮";
      layout();
    });

    window.addEventListener("keydown", function (event) {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.key === "+" || event.key === "=") document.getElementById("zoomIn").click();
      if (event.key === "-" || event.key === "_") document.getElementById("zoomOut").click();
      if (event.key === "0") frame(1, 0.5);
      if (event.key === "1") setScene("idle");
      if (event.key === "2") setScene("lost");
      if (event.key === "3") setHand("default");
      if (event.key === "4") setHand("raise");
      if (event.key === "5") setHand("foxtail");
      if (event.key === "6") setHand("finger");
    });
  }

  function bindStage(canvas) {
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const pointers = new Map();

    function localPoint(event) {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    canvas.addEventListener("wheel", function (event) {
      event.preventDefault();
      const point = localPoint(event);
      const factor = Math.exp(-event.deltaY * 0.00115);
      zoomToward(point.x, point.y, view.zoom * factor);
      markFrame();
    }, { passive: false });

    canvas.addEventListener("pointerdown", function (event) {
      pointers.set(event.pointerId, localPoint(event));
      if (pointers.size === 1) {
        dragging = true;
        lastX = event.clientX;
        lastY = event.clientY;
        canvas.classList.add("is-panning");
        canvas.setPointerCapture(event.pointerId);
      }
    });

    canvas.addEventListener("pointermove", function (event) {
      if (pointers.has(event.pointerId)) pointers.set(event.pointerId, localPoint(event));
      if (pointers.size === 2) {
        const pts = Array.from(pointers.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (canvas._pinch) {
          const midX = (pts[0].x + pts[1].x) / 2;
          const midY = (pts[0].y + pts[1].y) / 2;
          zoomToward(midX, midY, view.zoom * (dist / canvas._pinch));
          markFrame();
        }
        canvas._pinch = dist;
        dragging = false;
        return;
      }
      const point = localPoint(event);
      if (state.scene !== "lost") model.focus(point.x, point.y);
      if (!dragging) return;
      view.panX += event.clientX - lastX;
      view.panY += event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      layout();
    });

    function endPointer(event) {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) canvas._pinch = 0;
      if (pointers.size === 0) {
        dragging = false;
        canvas.classList.remove("is-panning");
      }
    }
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
    canvas.addEventListener("pointerleave", function (event) {
      if (!dragging && state.scene !== "lost") {
        const m = metrics();
        model.focus(m.box.left + m.availW / 2, m.box.top + m.availH * 0.34);
      }
      if (pointers.has(event.pointerId) && !dragging) endPointer(event);
    });
    canvas.addEventListener("dblclick", function () {
      if (view.zoom < 1.6) frame(3.15, 0.15);
      else frame(1, 0.5);
      document.querySelectorAll("[data-frame]").forEach(function (button) {
        const match = view.zoom < 1.6 ? button.dataset.frame === "full" : button.dataset.frame === "face";
        button.setAttribute("aria-pressed", String(match));
      });
    });
  }

  async function main() {
    if (!window.PIXI || !PIXI.live2d || !window.Live2DCubismCore) {
      fail("Live2D 运行库没有载入。请检查网络后再打开页面。");
      return;
    }
    bindControls();
    const wide = window.matchMedia("(min-width: 861px)").matches;
    if (wide) {
      document.body.classList.add("panel-open");
      document.getElementById("panelToggle").setAttribute("aria-expanded", "true");
    }
    try {
      await preload();
    } catch (error) {
      fail("模型文件载入失败：" + error.message);
      return;
    }
    setBoot(1, "正在组装模型");
    const stage = document.getElementById("stage");
    app = new PIXI.Application({
      resizeTo: stage,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      powerPreference: "high-performance"
    });
    stage.appendChild(app.view);
    try {
      model = await PIXI.live2d.Live2DModel.from(MODEL_URL, {
        autoInteract: false,
        motionPreload: "ALL"
      });
    } catch (error) {
      console.error(error);
      fail("模型解析失败。请用本地服务器打开，不要直接双击 html。");
      return;
    }
    app.stage.addChild(model);
    captureParams(model.internalModel.coreModel);
    model.internalModel.on("beforeModelUpdate", applyLook);
    bindStage(app.view);
    app.renderer.on("resize", layout);
    window.addEventListener("resize", function () { setTimeout(layout, 0); });
    frame(1, 0.5);
    await model.motion("Idle", 0, PIXI.live2d.MotionPriority.FORCE);
    renderStatus();
    boot.classList.add("is-done");
  }

  main();
})();
