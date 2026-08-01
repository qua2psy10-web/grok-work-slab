/**
 * 設計全体のオーケストレーション（単鉄筋／複鉄筋）
 */
window.RCSlab = window.RCSlab || {};

window.RCSlab.design = (function () {
  const M = () => window.RCSlab.materials;
  const loads = () => window.RCSlab.loads;
  const section = () => window.RCSlab.section;
  const bending = () => window.RCSlab.bending;
  const shear = () => window.RCSlab.shear;
  const rebar = () => window.RCSlab.rebar;
  const detail = () => window.RCSlab.detailChecks;

  function pickRebar(raw, modeKey, barKey, spacingKey, As_req, b_mm, d_mm, proposal) {
    if (raw[modeKey] === "manual") {
      const bar = M().getRebar(raw[barKey]);
      const spacing = raw[spacingKey];
      if (!bar || !(spacing > 0)) {
        return {
          used: null,
          error: "手動配筋の径・間隔を確認してください。",
        };
      }
      const As = rebar().providedAs(bar.area, spacing, b_mm);
      return {
        used: {
          name: bar.name,
          diameter: bar.diameter,
          barArea: bar.area,
          spacing,
          As,
          As_req,
          ok: As + 1e-6 >= As_req,
          note: "",
          source: "manual",
        },
        proposal,
      };
    }

    // auto
    let prop = proposal;
    if (!prop) {
      prop = rebar().propose({
        As_req,
        b_mm,
        d_mm,
        maxSpacing: raw.maxSpacing || 300,
        minSpacing: raw.minSpacing || 75,
        step: 25,
      });
    }
    if (prop.recommended) {
      const used = { ...prop.recommended, source: "auto" };
      used.As_req = As_req;
      used.ok = used.As + 1e-6 >= As_req;
      return { used, proposal: prop };
    }

    const assumed = M().getRebar(raw[barKey]) || M().getRebar("D16");
    const spacing = raw.minSpacing || 75;
    const As = rebar().providedAs(assumed.area, spacing, b_mm);
    return {
      used: {
        name: assumed.name,
        diameter: assumed.diameter,
        barArea: assumed.area,
        spacing,
        As,
        As_req,
        ok: false,
        note: "適合する配筋案なし",
        source: "fallback",
      },
      proposal: prop,
    };
  }

  /**
   * @param {object} raw - 画面入力
   */
  function run(raw) {
    const errors = validate(raw);
    if (errors.length) {
      return { ok: false, errors, warnings: [] };
    }

    const L_mm = raw.L_m * 1000;
    const t_mm = raw.t_mm;
    const b_mm = raw.b_mm;
    const cover_mm = raw.cover_mm;
    const coverTop_mm =
      raw.coverTop_mm != null && Number.isFinite(raw.coverTop_mm)
        ? raw.coverTop_mm
        : cover_mm;

    // sectionType: single | auto | double
    const sectionType = raw.sectionType || "single";

    const conc = {
      sigmaCk: raw.sigmaCk,
      sigmaCa: raw.sigmaCa,
      tauA: raw.tauA,
      Ec: raw.Ec,
      gamma: raw.gamma_c,
    };
    const steel = {
      name: raw.steelGrade,
      sigmaSa: raw.sigmaSa,
      Es: raw.Es || 200000,
    };

    const n = M().modularRatio(conc.Ec, steel.Es, raw.useFixedN, raw.nFixed);

    const assumedBarT =
      M().getRebar(raw.barName) || M().getRebar("D16");
    const assumedBarC =
      M().getRebar(raw.barNameComp) || M().getRebar("D13");

    let d_mm = section().effectiveDepth(t_mm, cover_mm, assumedBarT.diameter);
    let dPrime_mm = section().compressionDepth(
      coverTop_mm,
      assumedBarC.diameter
    );

    const load = loads().compute({
      t_mm,
      b_mm,
      gamma_c: conc.gamma,
      pavement_mm: raw.pavement_mm,
      gamma_p: raw.gamma_p,
      addl_dead_kNpm2: raw.addl_dead_kNpm2,
      live_kNpm2: raw.live_kNpm2,
      impact: raw.impact,
    });

    const M_Nmm = bending().simpleBeamMoment(load.w_Nmm, L_mm);
    const V_N = shear().simpleBeamShear(load.w_Nmm, L_mm);

    const bal = section().balancedSection(
      n,
      conc.sigmaCa,
      steel.sigmaSa,
      b_mm,
      d_mm
    );

    // --- 必要鉄筋量（断面形式に応じて） ---
    let req;
    let useDouble = false;

    if (sectionType === "single") {
      req = bending().requiredAs(M_Nmm, steel.sigmaSa, b_mm, d_mm, n);
      useDouble = false;
    } else if (sectionType === "double") {
      req = bending().requiredAsDouble(
        M_Nmm,
        conc.sigmaCa,
        steel.sigmaSa,
        b_mm,
        d_mm,
        dPrime_mm,
        n
      );
      // 常時複鉄筋でも M≤M1 なら As'=0（実質単鉄筋）
      useDouble = req.mode === "double";
    } else {
      // auto: M > M1 なら複鉄筋
      if (M_Nmm > bal.M1_Nmm + 1e-6) {
        req = bending().requiredAsDouble(
          M_Nmm,
          conc.sigmaCa,
          steel.sigmaSa,
          b_mm,
          d_mm,
          dPrime_mm,
          n
        );
        useDouble = req.mode === "double";
      } else {
        req = bending().requiredAs(M_Nmm, steel.sigmaSa, b_mm, d_mm, n);
        useDouble = false;
      }
    }

    // --- 引張配筋 ---
    let tensionProposal = rebar().propose({
      As_req: req.As_req,
      b_mm,
      d_mm,
      maxSpacing: raw.maxSpacing || 300,
      minSpacing: raw.minSpacing || 75,
      step: 25,
    });
    let tenPick = pickRebar(
      raw,
      "rebarMode",
      "barName",
      "spacing_mm",
      req.As_req,
      b_mm,
      d_mm,
      tensionProposal
    );
    let used = tenPick.used;
    tensionProposal = tenPick.proposal;

    // 確定径で d を更新し、必要量を再計算
    d_mm = section().effectiveDepth(t_mm, cover_mm, used.diameter);

    // --- 圧縮配筋（複鉄筋時） ---
    let usedComp = null;
    let compProposal = { candidates: [], recommended: null };

    function recomputeReq(dNow, dPNow) {
      if (sectionType === "single") {
        return {
          req: bending().requiredAs(M_Nmm, steel.sigmaSa, b_mm, dNow, n),
          useDouble: false,
        };
      }
      if (sectionType === "double") {
        const r = bending().requiredAsDouble(
          M_Nmm,
          conc.sigmaCa,
          steel.sigmaSa,
          b_mm,
          dNow,
          dPNow,
          n
        );
        return { req: r, useDouble: r.mode === "double" };
      }
      // auto
      const bal2 = section().balancedSection(
        n,
        conc.sigmaCa,
        steel.sigmaSa,
        b_mm,
        dNow
      );
      if (M_Nmm > bal2.M1_Nmm + 1e-6) {
        const r = bending().requiredAsDouble(
          M_Nmm,
          conc.sigmaCa,
          steel.sigmaSa,
          b_mm,
          dNow,
          dPNow,
          n
        );
        return { req: r, useDouble: r.mode === "double" };
      }
      return {
        req: bending().requiredAs(M_Nmm, steel.sigmaSa, b_mm, dNow, n),
        useDouble: false,
      };
    }

    // 圧縮側仮定径で d' を置き、再計算
    dPrime_mm = section().compressionDepth(coverTop_mm, assumedBarC.diameter);
    {
      const rr = recomputeReq(d_mm, dPrime_mm);
      req = rr.req;
      useDouble = rr.useDouble;
    }

    // 引張を最終 d で再提案
    if (raw.rebarMode !== "manual") {
      tensionProposal = rebar().propose({
        As_req: req.As_req,
        b_mm,
        d_mm,
        maxSpacing: raw.maxSpacing || 300,
        minSpacing: raw.minSpacing || 75,
        step: 25,
      });
      tenPick = pickRebar(
        raw,
        "rebarMode",
        "barName",
        "spacing_mm",
        req.As_req,
        b_mm,
        d_mm,
        tensionProposal
      );
      used = tenPick.used;
      tensionProposal = tenPick.proposal;
      d_mm = section().effectiveDepth(t_mm, cover_mm, used.diameter);
      const rr = recomputeReq(d_mm, dPrime_mm);
      req = rr.req;
      useDouble = rr.useDouble;
      used.As = rebar().providedAs(used.barArea, used.spacing, b_mm);
      used.As_req = req.As_req;
      used.ok = used.As + 1e-6 >= req.As_req;
    } else {
      used.As = rebar().providedAs(used.barArea, used.spacing, b_mm);
      used.As_req = req.As_req;
      used.ok = used.As + 1e-6 >= req.As_req;
    }

    if (useDouble) {
      const AsP_req = req.AsPrime_req || 0;
      // 圧縮配筋の提案・選定（仮の d' 用径で）
      if (raw.rebarModeComp === "manual") {
        const barC = M().getRebar(raw.barNameComp);
        const spacingC = raw.spacingComp_mm;
        const AsP = rebar().providedAs(barC.area, spacingC, b_mm);
        usedComp = {
          name: barC.name,
          diameter: barC.diameter,
          barArea: barC.area,
          spacing: spacingC,
          As: AsP,
          As_req: AsP_req,
          ok: AsP + 1e-6 >= AsP_req,
          note: "",
          source: "manual",
        };
      } else {
        compProposal = rebar().propose({
          As_req: AsP_req,
          b_mm,
          d_mm,
          maxSpacing: raw.maxSpacing || 300,
          minSpacing: raw.minSpacing || 75,
          step: 25,
        });
        if (compProposal.recommended) {
          usedComp = { ...compProposal.recommended, source: "auto" };
          usedComp.As_req = AsP_req;
          usedComp.ok = usedComp.As + 1e-6 >= AsP_req;
        } else {
          const barC = assumedBarC;
          const spacingC = raw.minSpacing || 75;
          const AsP = rebar().providedAs(barC.area, spacingC, b_mm);
          usedComp = {
            name: barC.name,
            diameter: barC.diameter,
            barArea: barC.area,
            spacing: spacingC,
            As: AsP,
            As_req: AsP_req,
            ok: false,
            note: "適合する圧縮配筋案なし",
            source: "fallback",
          };
        }
      }

      // 確定 φ' で d' 更新 → 必要量再計算 → As 再評価
      dPrime_mm = section().compressionDepth(coverTop_mm, usedComp.diameter);
      {
        const rr = recomputeReq(d_mm, dPrime_mm);
        req = rr.req;
        useDouble = rr.useDouble;
      }

      // 複鉄筋のままなら圧縮 As を最終 As'_req で更新
      if (useDouble) {
        const AsP_req2 = req.AsPrime_req || 0;
        if (raw.rebarModeComp !== "manual") {
          compProposal = rebar().propose({
            As_req: AsP_req2,
            b_mm,
            d_mm,
            maxSpacing: raw.maxSpacing || 300,
            minSpacing: raw.minSpacing || 75,
            step: 25,
          });
          if (compProposal.recommended) {
            usedComp = { ...compProposal.recommended, source: "auto" };
            dPrime_mm = section().compressionDepth(
              coverTop_mm,
              usedComp.diameter
            );
            const rr = recomputeReq(d_mm, dPrime_mm);
            req = rr.req;
            useDouble = rr.useDouble;
          }
        }
        if (useDouble && usedComp) {
          usedComp.As = rebar().providedAs(
            usedComp.barArea,
            usedComp.spacing,
            b_mm
          );
          usedComp.As_req = req.AsPrime_req || 0;
          usedComp.ok = usedComp.As + 1e-6 >= usedComp.As_req;
        }
        // 引張 As_req も更新
        used.As_req = req.As_req;
        used.ok = used.As + 1e-6 >= req.As_req;
      } else {
        // 再計算で単鉄筋に戻った
        usedComp = null;
        compProposal = { candidates: [], recommended: null };
        used.As_req = req.As_req;
        used.ok = used.As + 1e-6 >= req.As_req;
      }
    }

    const As_use = used.As;
    const AsPrime_use = usedComp ? usedComp.As : 0;

    // --- 応力度照査 ---
    let bend;
    if (useDouble && AsPrime_use > 0) {
      bend = bending().checkDouble(
        M_Nmm,
        As_use,
        AsPrime_use,
        b_mm,
        d_mm,
        dPrime_mm,
        n,
        conc.sigmaCa,
        steel.sigmaSa
      );
    } else {
      bend = bending().check(
        M_Nmm,
        As_use,
        b_mm,
        d_mm,
        n,
        conc.sigmaCa,
        steel.sigmaSa
      );
    }

    const shr = shear().check(V_N, b_mm, d_mm, bend.j, conc.tauA);
    const minSt = rebar().minSteelCheck(As_use, b_mm, d_mm, raw.pMin);

    // --- 詳細照査（最小厚・間隔・配力・定着） ---
    const tauOaInput =
      raw.tauOa != null && raw.tauOa !== "" && Number.isFinite(Number(raw.tauOa))
        ? Number(raw.tauOa)
        : null;
    const details = detail().runAll({
      t_mm,
      L_mm,
      b_mm,
      d_mm,
      As_main: As_use,
      mainSpacing_mm: used.spacing,
      mainDiameter_mm: used.diameter,
      compSpacing_mm: usedComp ? usedComp.spacing : null,
      compDiameter_mm: usedComp ? usedComp.diameter : null,
      maxSpacing: raw.maxSpacing || 300,
      minSpacing: raw.minSpacing || 75,
      tMinAbs_mm: raw.tMinAbs_mm ?? 160,
      spanDivisor: raw.spanDivisor ?? 30,
      maxSpacingByT: raw.maxSpacingByT ?? 1.5,
      minClearFactor: raw.minClearFactor ?? 1.0,
      distRatio: raw.distRatio ?? 0.3,
      pDistMin: raw.pDistMin ?? 0.001,
      distMode: raw.distMode || "auto",
      distBarName: raw.distBarName || "D13",
      distSpacing_mm: raw.distSpacing_mm,
      sigmaSa: steel.sigmaSa,
      sigmaCk: conc.sigmaCk,
      tauOa: tauOaInput,
      lapFactor: raw.lapFactor ?? 1.0,
    });

    const warnings = [];
    if (d_mm < 50) {
      warnings.push(
        "有効高さ d が非常に小さいです。かぶ・径・版厚を確認してください。"
      );
    }
    if (useDouble && dPrime_mm >= d_mm) {
      warnings.push("d' ≥ d です。上側かぶり・圧縮鉄筋径を確認してください。");
    }
    if (bend.p > 0.02) {
      warnings.push("引張鉄筋比が大きめです。版厚の増加を検討してください。");
    }
    if (useDouble && bend.compressionSteelInTension) {
      warnings.push(
        "中立軸が圧縮鉄筋より上にあり、圧縮鉄筋が引張域にあります。断面を見直してください。"
      );
    }
    if (!tensionProposal.recommended && raw.rebarMode === "auto") {
      warnings.push(
        "自動配筋（引張）で適合案が見つかりませんでした。版厚または材料を見直してください。"
      );
    }
    if (
      useDouble &&
      raw.rebarModeComp !== "manual" &&
      !compProposal.recommended
    ) {
      warnings.push(
        "自動配筋（圧縮）で適合案が見つかりませんでした。版厚の増加を検討してください。"
      );
    }
    if (sectionType === "auto" && useDouble) {
      warnings.push(
        "作用モーメントがつり合い断面の抵抗モーメント M1 を超えるため、複鉄筋として設計しました。"
      );
    }
    if (sectionType === "double" && !useDouble) {
      warnings.push(
        "複鉄筋（常時）を選択していますが M ≤ M1 のため、圧縮鉄筋は不要（As'=0）です。"
      );
    }
    if (req.note) warnings.push(req.note);
    if (!details.thickness.ok) {
      warnings.push(
        `最小版厚を下回っています（必要 ${details.thickness.tMin.toFixed(1)} mm）。`
      );
    }
    if (!details.mainSpacing.ok) {
      warnings.push(
        `主鉄筋間隔が範囲外です（許容 ${details.mainSpacing.minAllow.toFixed(0)}〜${details.mainSpacing.maxAllow.toFixed(0)} mm）。`
      );
    }
    if (details.compSpacing && !details.compSpacing.ok) {
      warnings.push("圧縮鉄筋間隔が範囲外です。");
    }
    if (!details.distribution.ok) {
      warnings.push("配力鉄筋量が不足しています。");
    }

    const rebarOk = used.ok && (!useDouble || !usedComp || usedComp.ok);
    const detailOk = details.ok;
    const overallOk =
      bend.ok && shr.ok && minSt.ok && rebarOk && detailOk && d_mm > 0;

    const phiT = used.diameter;
    const phiC = usedComp ? usedComp.diameter : assumedBarC.diameter;
    const formula_d = `d = t − c − φ/2 = ${t_mm} − ${cover_mm} − ${phiT}/2 = ${d_mm.toFixed(1)} mm`;
    const formula_dPrime = useDouble
      ? `d' = c' + φ'/2 = ${coverTop_mm} + ${phiC}/2 = ${dPrime_mm.toFixed(1)} mm`
      : null;

    return {
      ok: true,
      errors: [],
      warnings,
      input: {
        ...raw,
        L_mm,
        t_mm,
        b_mm,
        cover_mm,
        coverTop_mm,
        sectionType,
      },
      materials: { concrete: conc, steel, n },
      load,
      forces: {
        M_Nmm,
        M_kNm: M_Nmm / 1e6,
        V_N,
        V_kN: V_N / 1000,
      },
      geometry: {
        d_mm,
        dPrime_mm: useDouble ? dPrime_mm : null,
        formula_d,
        formula_dPrime,
        useDouble,
      },
      required: {
        As_req: req.As_req,
        AsPrime_req: useDouble ? req.AsPrime_req || 0 : 0,
        j_for_req: req.j,
        k_for_req: req.k,
        mode: useDouble ? "double" : "single",
        M1_Nmm: req.M1_Nmm != null ? req.M1_Nmm : bal.M1_Nmm,
        M1_kNm:
          (req.M1_Nmm != null ? req.M1_Nmm : bal.M1_Nmm) / 1e6,
        M2_Nmm: req.M2_Nmm || 0,
        M2_kNm: (req.M2_Nmm || 0) / 1e6,
        As1: req.As1 || null,
        As2: req.As2 || null,
        sigmaSPrime_des: req.sigmaSPrime_des || null,
        p_bal: bal.p,
      },
      rebar: {
        used,
        usedComp: useDouble ? usedComp : null,
        proposal: tensionProposal,
        proposalComp: useDouble ? compProposal : { candidates: [], recommended: null },
      },
      bending: bend,
      shear: shr,
      minSteel: minSt,
      details,
      overallOk,
    };
  }

  function validate(raw) {
    const errors = [];
    if (!(raw.L_m > 0)) errors.push("支間長 L は正の値を入力してください。");
    if (!(raw.t_mm > 0)) errors.push("床版厚 t は正の値を入力してください。");
    if (!(raw.b_mm > 0)) errors.push("設計幅 b は正の値を入力してください。");
    if (!(raw.cover_mm >= 0)) errors.push("かぶり c は 0 以上を入力してください。");
    if (!(raw.sigmaCa > 0)) errors.push("許容曲げ圧縮応力度 σca を確認してください。");
    if (!(raw.sigmaSa > 0)) errors.push("許容引張応力度 σsa を確認してください。");
    if (!(raw.tauA > 0)) errors.push("許容せん断応力度 τa を確認してください。");
    if (raw.live_kNpm2 < 0 || raw.impact < 0) {
      errors.push("活荷重・衝撃係数は 0 以上にしてください。");
    }

    const sectionType = raw.sectionType || "single";
    const coverTop =
      raw.coverTop_mm != null && Number.isFinite(raw.coverTop_mm)
        ? raw.coverTop_mm
        : raw.cover_mm;
    if (
      (sectionType === "double" || sectionType === "auto") &&
      !(coverTop >= 0)
    ) {
      errors.push("上側かぶり c' は 0 以上を入力してください。");
    }

    if (raw.rebarMode === "manual") {
      const bar = M().getRebar(raw.barName);
      if (!bar) errors.push("引張鉄筋径を選択してください。");
      if (!(raw.spacing_mm > 0)) {
        errors.push("引張鉄筋間隔は正の値を入力してください。");
      }
    }
    if (
      (sectionType === "double" || sectionType === "auto") &&
      raw.rebarModeComp === "manual"
    ) {
      const barC = M().getRebar(raw.barNameComp);
      if (!barC) errors.push("圧縮鉄筋径を選択してください。");
      if (!(raw.spacingComp_mm > 0)) {
        errors.push("圧縮鉄筋間隔は正の値を入力してください。");
      }
    }
    if (raw.distMode === "manual") {
      const barD = M().getRebar(raw.distBarName);
      if (!barD) errors.push("配力鉄筋径を選択してください。");
      if (!(raw.distSpacing_mm > 0)) {
        errors.push("配力鉄筋間隔は正の値を入力してください。");
      }
    }

    const barT = M().getRebar(raw.barName) || M().getRebar("D16");
    const d0 = section().effectiveDepth(
      raw.t_mm,
      raw.cover_mm,
      barT.diameter
    );
    if (!(d0 > 0)) {
      errors.push(
        "有効高さ d が正になりません。版厚・かぶり・径を見直してください。"
      );
    }
    return errors;
  }

  return { run, validate };
})();
