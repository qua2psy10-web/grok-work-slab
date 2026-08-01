/**
 * UI 配線
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const M = window.RCSlab.materials;
  const F = window.RCSlab.format;
  const design = window.RCSlab.design;
  const report = window.RCSlab.report;
  const presets = window.RCSlab.presets;

  let lastResult = null;
  /** プリセット適用中は input イベントで再計算を抑止しない（最後に1回） */

  function todayISO() {
    const d = new Date();
    const z = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  }

  function fillMaterialSelects() {
    const concSel = $("sigmaCk");
    concSel.innerHTML = M.listConcreteKeys()
      .map((k) => `<option value="${k}">σck = ${k} N/mm²</option>`)
      .join("");
    concSel.value = "24";

    const steelSel = $("steelGrade");
    steelSel.innerHTML = M.listSteelKeys()
      .map((k) => `<option value="${k}">${k}</option>`)
      .join("");
    steelSel.value = "SD345";

    const barOpts = M.REBAR_TYPES.map(
      (r) =>
        `<option value="${r.name}">${r.name}（${r.area} mm²）</option>`
    ).join("");

    $("barName").innerHTML = barOpts;
    $("barName").value = "D16";
    $("barNameComp").innerHTML = barOpts;
    $("barNameComp").value = "D13";
    $("distBarName").innerHTML = barOpts;
    $("distBarName").value = "D13";
  }

  function fillPresetSelects() {
    const builtin = $("presetBuiltin");
    builtin.innerHTML = presets
      .listBuiltin()
      .map(
        (p) =>
          `<option value="${p.id}">${escapeHtml(p.name)} — ${escapeHtml(p.description)}</option>`
      )
      .join("");

    refreshSavedSelect();
  }

  function refreshSavedSelect() {
    const sel = $("presetSaved");
    const list = presets.listSaved();
    const cur = sel.value;
    sel.innerHTML =
      `<option value="">（なし）</option>` +
      list
        .map((c) => {
          const when = c.savedAt
            ? new Date(c.savedAt).toLocaleString("ja-JP")
            : "";
          return `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}${when ? " — " + when : ""}</option>`;
        })
        .join("");
    if (cur && list.some((c) => c.id === cur)) sel.value = cur;
  }

  function applyConcreteDefaults() {
    const c = M.getConcrete(Number($("sigmaCk").value));
    if (!c) return;
    $("sigmaCa").value = c.sigmaCa;
    $("tauA").value = c.tauA;
    $("Ec").value = c.Ec;
    $("gamma_c").value = c.gamma;
  }

  function applySteelDefaults() {
    const s = M.getSteel($("steelGrade").value);
    if (!s) return;
    $("sigmaSa").value = s.sigmaSa;
  }

  function readInputs() {
    const tauRaw = $("tauOa").value.trim();
    return {
      projectName: $("projectName").value.trim(),
      bridgeName: $("bridgeName").value.trim(),
      spanLabel: $("spanLabel").value.trim(),
      author: $("author").value.trim(),
      date: $("date").value,
      notes: $("notes").value,

      L_m: num("L_m"),
      t_mm: num("t_mm"),
      b_mm: num("b_mm"),
      cover_mm: num("cover_mm"),
      coverTop_mm: num("coverTop_mm"),
      sectionType: $("sectionType").value,

      sigmaCk: num("sigmaCk"),
      sigmaCa: num("sigmaCa"),
      tauA: num("tauA"),
      Ec: num("Ec"),
      gamma_c: num("gamma_c"),
      steelGrade: $("steelGrade").value,
      sigmaSa: num("sigmaSa"),
      Es: 200000,
      useFixedN: $("useFixedN").checked,
      nFixed: num("nFixed"),

      pavement_mm: num("pavement_mm"),
      gamma_p: num("gamma_p"),
      addl_dead_kNpm2: num("addl_dead_kNpm2"),
      live_kNpm2: num("live_kNpm2"),
      impact: num("impact"),

      rebarMode: $("rebarMode").value,
      barName: $("barName").value,
      spacing_mm: num("spacing_mm"),
      rebarModeComp: $("rebarModeComp").value,
      barNameComp: $("barNameComp").value,
      spacingComp_mm: num("spacingComp_mm"),
      maxSpacing: num("maxSpacing"),
      minSpacing: num("minSpacing"),
      pMin: num("pMin"),

      // 詳細照査
      tMinAbs_mm: num("tMinAbs_mm"),
      spanDivisor: num("spanDivisor"),
      maxSpacingByT: num("maxSpacingByT"),
      distRatio: num("distRatio"),
      pDistMin: num("pDistMin"),
      lapFactor: num("lapFactor"),
      tauOa: tauRaw === "" ? "" : num("tauOa"),
      distMode: $("distMode").value,
      distBarName: $("distBarName").value,
      distSpacing_mm: num("distSpacing_mm"),
    };
  }

  function num(id) {
    const v = parseFloat($(id).value);
    return Number.isFinite(v) ? v : NaN;
  }

  function setField(id, value) {
    const el = $(id);
    if (!el) return;
    if (el.type === "checkbox") {
      el.checked = !!value;
    } else if (value === undefined || value === null) {
      // skip
    } else {
      el.value = value;
    }
  }

  /**
   * プリセット / 保存データの適用
   */
  function applyData(data, opts) {
    if (!data) return;
    const o = opts || {};
    const keys = [
      "projectName",
      "bridgeName",
      "spanLabel",
      "author",
      "date",
      "notes",
      "L_m",
      "t_mm",
      "b_mm",
      "cover_mm",
      "coverTop_mm",
      "sectionType",
      "sigmaCk",
      "steelGrade",
      "sigmaCa",
      "sigmaSa",
      "tauA",
      "Ec",
      "gamma_c",
      "useFixedN",
      "nFixed",
      "pavement_mm",
      "gamma_p",
      "addl_dead_kNpm2",
      "live_kNpm2",
      "impact",
      "rebarMode",
      "barName",
      "spacing_mm",
      "rebarModeComp",
      "barNameComp",
      "spacingComp_mm",
      "maxSpacing",
      "minSpacing",
      "pMin",
      "tMinAbs_mm",
      "spanDivisor",
      "maxSpacingByT",
      "distRatio",
      "pDistMin",
      "lapFactor",
      "tauOa",
      "distMode",
      "distBarName",
      "distSpacing_mm",
    ];
    for (const k of keys) {
      if (data[k] !== undefined) setField(k, data[k]);
    }
    // σck / 鋼種から材料既定を埋める（明示値があれば後で上書き済み）
    if (o.applyMaterialDefaults !== false) {
      if (data.sigmaCa == null) applyConcreteDefaults();
      else {
        applyConcreteDefaults();
        if (data.sigmaCa != null) setField("sigmaCa", data.sigmaCa);
        if (data.tauA != null) setField("tauA", data.tauA);
        if (data.Ec != null) setField("Ec", data.Ec);
        if (data.gamma_c != null) setField("gamma_c", data.gamma_c);
      }
      if (data.sigmaSa == null) applySteelDefaults();
      else {
        applySteelDefaults();
        setField("sigmaSa", data.sigmaSa);
      }
    }
    if (!data.date) $("date").value = todayISO();
    $("nFixed").disabled = !$("useFixedN").checked;
    setRebarModeUI();
  }

  function setRebarModeUI() {
    const manual = $("rebarMode").value === "manual";
    $("manualRebarFields").hidden = !manual;

    const manualC = $("rebarModeComp").value === "manual";
    $("manualCompRebarFields").hidden = !manualC;

    const manualD = $("distMode").value === "manual";
    $("manualDistFields").hidden = !manualD;

    const st = $("sectionType").value;
    const showComp = st === "double" || st === "auto";
    $("compRebarSection").hidden = !showComp;
    $("coverTopLabel").hidden = !showComp;
    $("sectionTypeHint").hidden = st === "single";
  }

  function renderErrors(errors) {
    const el = $("errorBox");
    if (!errors || !errors.length) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    el.hidden = false;
    el.innerHTML =
      "<strong>入力エラー</strong><ul>" +
      errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("") +
      "</ul>";
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderCandidates(bodyId, list, recommended, usedSource) {
    const cand = $(bodyId);
    if (!cand) return;
    cand.innerHTML = (list || [])
      .map((c, i) => {
        const rec =
          recommended &&
          c.name === recommended.name &&
          c.spacing === recommended.spacing
            ? ' class="rec"'
            : "";
        return `<tr${rec}>
          <td>${escapeHtml(c.name)}</td>
          <td>${F.num(c.spacing, 0)}</td>
          <td>${F.num(c.As, 1)}</td>
          <td><span class="badge ${c.ok ? "badge-ok" : "badge-ng"}">${F.okNg(c.ok)}</span></td>
          <td>${escapeHtml(c.note || (i === 0 && usedSource === "auto" ? "推奨" : ""))}</td>
        </tr>`;
      })
      .join("");
  }

  function renderResult(result) {
    const summary = $("resultSummary");
    const table = $("resultTable");
    const warn = $("warnBox");
    const detailTable = $("detailTable");

    if (!result.ok) {
      summary.innerHTML = `<div class="overall overall-ng">計算不可</div>`;
      table.innerHTML = "";
      detailTable.innerHTML = "";
      $("candidatesBody").innerHTML = "";
      $("candidatesCompBody").innerHTML = "";
      $("candidatesDistBody").innerHTML = "";
      $("compCandidatesBlock").hidden = true;
      warn.hidden = true;
      $("reportArea").innerHTML = report.build(result, {});
      return;
    }

    const f = F;
    const overallClass = result.overallOk ? "overall-ok" : "overall-ng";
    const overallText = result.overallOk ? "総合判定：OK" : "総合判定：NG";
    summary.innerHTML = `<div class="overall ${overallClass}">${overallText}</div>`;

    const used = result.rebar.used;
    const usedC = result.rebar.usedComp;
    const isDouble = result.geometry.useDouble;
    const modeLabel = isDouble ? "複鉄筋" : "単鉄筋";
    const det = result.details;
    const distU = det && det.distribution ? det.distribution.used : null;

    let rows = `
      <tr><th>断面形式</th><td>${modeLabel}${result.input.sectionType === "auto" ? "（自動判定）" : ""}</td></tr>
      <tr><th>設計荷重 w</th><td>${f.num(result.load.w_kNpm, 3)} kN/m</td></tr>
      <tr><th>曲げモーメント M</th><td>${f.num(result.forces.M_kNm, 3)} kN·m</td></tr>
      <tr><th>せん断力 V</th><td>${f.num(result.forces.V_kN, 3)} kN</td></tr>
      <tr><th>有効高さ d</th><td>${f.num(result.geometry.d_mm, 1)} mm</td></tr>
    `;

    if (isDouble && result.geometry.dPrime_mm != null) {
      rows += `<tr><th>圧縮鉄筋位置 d'</th><td>${f.num(result.geometry.dPrime_mm, 1)} mm</td></tr>`;
      rows += `<tr><th>つり合い抵抗 M1</th><td>${f.num(result.required.M1_kNm, 3)} kN·m</td></tr>`;
      rows += `<tr><th>超過モーメント M2</th><td>${f.num(result.required.M2_kNm, 3)} kN·m</td></tr>`;
    }

    rows += `
      <tr><th>必要鉄筋量 As,req</th><td>${f.num(result.required.As_req, 1)} mm²</td></tr>
      <tr><th>使用配筋（引張）</th><td>${escapeHtml(used.name)} @ ${f.num(used.spacing, 0)} mm（As=${f.num(used.As, 1)} mm²）</td></tr>
    `;

    if (isDouble && usedC) {
      rows += `
        <tr><th>必要圧縮鉄筋 As',req</th><td>${f.num(result.required.AsPrime_req, 1)} mm²</td></tr>
        <tr><th>使用配筋（圧縮）</th><td>${escapeHtml(usedC.name)} @ ${f.num(usedC.spacing, 0)} mm（As'=${f.num(usedC.As, 1)} mm²）</td></tr>
      `;
    }

    if (distU) {
      rows += `<tr><th>配力鉄筋</th><td>${escapeHtml(distU.name)} @ ${f.num(distU.spacing, 0)} mm（As,dist=${f.num(distU.As, 1)} mm²）</td></tr>`;
    }

    rows += `
      <tr><th>σc / σca</th><td>${f.num(result.bending.sigmaC, 3)} / ${f.num(result.bending.sigmaCa, 2)} N/mm²　<span class="badge ${result.bending.okC ? "badge-ok" : "badge-ng"}">${f.okNg(result.bending.okC)}</span></td></tr>
      <tr><th>σs / σsa</th><td>${f.num(result.bending.sigmaS, 2)} / ${f.num(result.bending.sigmaSa, 0)} N/mm²　<span class="badge ${result.bending.okS ? "badge-ok" : "badge-ng"}">${f.okNg(result.bending.okS)}</span></td></tr>
    `;

    if (isDouble && usedC) {
      const okSp = result.bending.okSPrime !== false;
      rows += `<tr><th>σs' / σsa</th><td>${f.num(result.bending.sigmaSPrime, 2)} / ${f.num(result.bending.sigmaSa, 0)} N/mm²　<span class="badge ${okSp ? "badge-ok" : "badge-ng"}">${f.okNg(okSp)}</span></td></tr>`;
    }

    rows += `
      <tr><th>τ / τa</th><td>${f.num(result.shear.tau, 4)} / ${f.num(result.shear.tauA, 3)} N/mm²　<span class="badge ${result.shear.ok ? "badge-ok" : "badge-ng"}">${f.okNg(result.shear.ok)}</span></td></tr>
      <tr><th>最小鉄筋量</th><td><span class="badge ${result.minSteel.ok ? "badge-ok" : "badge-ng"}">${f.okNg(result.minSteel.ok)}</span></td></tr>
      <tr><th>詳細照査（参考）</th><td><span class="badge ${det && det.ok ? "badge-ok" : "badge-ng"}">${f.okNg(det && det.ok)}</span></td></tr>
    `;

    table.innerHTML = rows;

    // 詳細表
    if (det) {
      let drows = `
        <tr><th>最小版厚</th><td>t=${f.num(det.thickness.t_mm, 0)} / 必要 ${f.num(det.thickness.tMin, 1)} mm　<span class="badge ${det.thickness.ok ? "badge-ok" : "badge-ng"}">${f.okNg(det.thickness.ok)}</span><br><span style="color:var(--muted);font-size:0.8em">${escapeHtml(det.thickness.formula)}</span></td></tr>
        <tr><th>主鉄筋間隔</th><td>${f.num(det.mainSpacing.spacing, 0)} mm（許容 ${f.num(det.mainSpacing.minAllow, 0)}〜${f.num(det.mainSpacing.maxAllow, 0)}）　<span class="badge ${det.mainSpacing.ok ? "badge-ok" : "badge-ng"}">${f.okNg(det.mainSpacing.ok)}</span></td></tr>
      `;
      if (det.compSpacing) {
        drows += `<tr><th>圧縮鉄筋間隔</th><td>${f.num(det.compSpacing.spacing, 0)} mm　<span class="badge ${det.compSpacing.ok ? "badge-ok" : "badge-ng"}">${f.okNg(det.compSpacing.ok)}</span></td></tr>`;
      }
      drows += `
        <tr><th>配力 As,req</th><td>${f.num(det.distribution.As_req, 1)} mm²（${escapeHtml(det.distribution.formula)}）</td></tr>
        <tr><th>配力鉄筋</th><td>${escapeHtml(distU.name)} @ ${f.num(distU.spacing, 0)} → As=${f.num(distU.As, 1)}　<span class="badge ${det.distribution.ok ? "badge-ok" : "badge-ng"}">${f.okNg(det.distribution.ok)}</span></td></tr>
        <tr><th>基本定着長 ld</th><td>${f.num(det.development.ld_mm, 0)} mm（τoa=${f.num(det.development.tauOa, 2)}）</td></tr>
        <tr><th>重ね継手長 ls</th><td>${f.num(det.development.ls_mm, 0)} mm（係数 ${f.num(det.development.lapFactor, 2)}）</td></tr>
      `;
      if (det.developmentComp) {
        drows += `<tr><th>圧縮筋 ld / ls</th><td>${f.num(det.developmentComp.ld_mm, 0)} / ${f.num(det.developmentComp.ls_mm, 0)} mm</td></tr>`;
      }
      drows += `<tr><th>注記</th><td style="font-size:0.82em;color:var(--muted)">${escapeHtml(det.development.note || "")}</td></tr>`;
      detailTable.innerHTML = drows;
    } else {
      detailTable.innerHTML = "";
    }

    renderCandidates(
      "candidatesBody",
      result.rebar.proposal.candidates,
      result.rebar.proposal.recommended,
      result.rebar.used.source
    );

    const compBlock = $("compCandidatesBlock");
    if (isDouble && result.rebar.proposalComp) {
      compBlock.hidden = false;
      renderCandidates(
        "candidatesCompBody",
        result.rebar.proposalComp.candidates,
        result.rebar.proposalComp.recommended,
        usedC && usedC.source
      );
    } else {
      compBlock.hidden = true;
      $("candidatesCompBody").innerHTML = "";
    }

    if (det && det.distribution) {
      renderCandidates(
        "candidatesDistBody",
        det.distribution.proposal.candidates,
        det.distribution.proposal.recommended,
        distU && distU.source
      );
    } else {
      $("candidatesDistBody").innerHTML = "";
    }

    if (result.warnings && result.warnings.length) {
      warn.hidden = false;
      warn.innerHTML =
        "<strong>注意</strong><ul>" +
        result.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("") +
        "</ul>";
    } else {
      warn.hidden = true;
      warn.innerHTML = "";
    }

    const meta = {
      projectName: result.input.projectName || "RC床版 設計計算書",
      bridgeName: result.input.bridgeName,
      spanLabel: result.input.spanLabel,
      author: result.input.author,
      date: result.input.date,
      notes: result.input.notes,
    };
    $("reportArea").innerHTML = report.build(result, meta);
  }

  function recalculate() {
    const raw = readInputs();
    const result = design.run(raw);
    lastResult = result;
    renderErrors(result.errors);
    renderResult(result);
  }

  function debounce(fn, ms) {
    let t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  function initDefaults() {
    fillMaterialSelects();
    fillPresetSelects();
    const def = presets.getBuiltin("default");
    if (def) applyData(def.data, { applyMaterialDefaults: true });
    else {
      $("date").value = todayISO();
      $("sectionType").value = "auto";
      applyConcreteDefaults();
      applySteelDefaults();
      setRebarModeUI();
    }
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function bind() {
    const debounced = debounce(recalculate, 200);
    document.querySelectorAll("input, select, textarea").forEach((el) => {
      // プリセット選択自体では再計算しない
      if (
        el.id === "presetBuiltin" ||
        el.id === "presetSaved" ||
        el.id === "saveCaseName" ||
        el.id === "importFile"
      ) {
        return;
      }
      el.addEventListener("input", debounced);
      el.addEventListener("change", debounced);
    });

    $("sigmaCk").addEventListener("change", () => {
      applyConcreteDefaults();
      recalculate();
    });
    $("steelGrade").addEventListener("change", () => {
      applySteelDefaults();
      recalculate();
    });
    $("rebarMode").addEventListener("change", () => {
      setRebarModeUI();
      recalculate();
    });
    $("rebarModeComp").addEventListener("change", () => {
      setRebarModeUI();
      recalculate();
    });
    $("distMode").addEventListener("change", () => {
      setRebarModeUI();
      recalculate();
    });
    $("sectionType").addEventListener("change", () => {
      setRebarModeUI();
      recalculate();
    });
    $("useFixedN").addEventListener("change", () => {
      $("nFixed").disabled = !$("useFixedN").checked;
      recalculate();
    });

    $("btnApplyPreset").addEventListener("click", (e) => {
      e.preventDefault();
      const id = $("presetBuiltin").value;
      const p = presets.getBuiltin(id);
      if (!p) return;
      applyData(p.data, { applyMaterialDefaults: true });
      recalculate();
    });

    $("btnLoadSaved").addEventListener("click", (e) => {
      e.preventDefault();
      const id = $("presetSaved").value;
      if (!id) {
        alert("保存済み条件を選んでください。");
        return;
      }
      const c = presets.getSaved(id);
      if (!c) {
        alert("条件が見つかりません。");
        refreshSavedSelect();
        return;
      }
      applyData(c.data, { applyMaterialDefaults: true });
      $("saveCaseName").value = c.name;
      recalculate();
    });

    $("btnSaveCase").addEventListener("click", (e) => {
      e.preventDefault();
      const name =
        $("saveCaseName").value.trim() ||
        $("projectName").value.trim() ||
        "無題の条件";
      const entry = presets.saveCase(name, readInputs());
      refreshSavedSelect();
      $("presetSaved").value = entry.id;
      alert(`「${entry.name}」を保存しました。`);
    });

    $("btnDeleteSaved").addEventListener("click", (e) => {
      e.preventDefault();
      const id = $("presetSaved").value;
      if (!id) {
        alert("削除する条件を選んでください。");
        return;
      }
      if (!confirm("この保存条件を削除しますか？")) return;
      presets.deleteCase(id);
      refreshSavedSelect();
    });

    $("btnExportJson").addEventListener("click", (e) => {
      e.preventDefault();
      const name =
        $("saveCaseName").value.trim() ||
        $("projectName").value.trim() ||
        "rc-slab-case";
      const json = presets.exportJson({
        name,
        data: readInputs(),
      });
      const safe = name.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 40);
      downloadText(`${safe || "rc-slab-case"}.json`, json);
    });

    $("btnImportJson").addEventListener("click", (e) => {
      e.preventDefault();
      $("importFile").click();
    });

    $("importFile").addEventListener("change", () => {
      const file = $("importFile").files && $("importFile").files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = presets.parseImport(String(reader.result));
          applyData(parsed.data, { applyMaterialDefaults: true });
          $("saveCaseName").value = parsed.name || "";
          recalculate();
          alert("JSON を読み込みました。");
        } catch (err) {
          alert("読込に失敗しました: " + (err.message || err));
        }
        $("importFile").value = "";
      };
      reader.readAsText(file, "utf-8");
    });

    $("btnCalc").addEventListener("click", (e) => {
      e.preventDefault();
      recalculate();
      $("resultsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    function doPrint(e) {
      e.preventDefault();
      recalculate();
      window.print();
    }
    $("btnPrint").addEventListener("click", doPrint);
    $("btnPrintReport").addEventListener("click", doPrint);
    $("btnScrollReport").addEventListener("click", (e) => {
      e.preventDefault();
      recalculate();
      $("reportSection").scrollIntoView({ behavior: "smooth" });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initDefaults();
    bind();
    $("nFixed").disabled = !$("useFixedN").checked;
    recalculate();
  });
})();
