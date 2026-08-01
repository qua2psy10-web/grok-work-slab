/**
 * 詳細照査（参考）: 最小版厚・配筋間隔・配力鉄筋・定着長
 * 道路橋示方書の全文準拠ではなく、教育・補助用の簡易式です。
 */
window.RCSlab = window.RCSlab || {};

window.RCSlab.detailChecks = (function () {
  const rebar = () => window.RCSlab.rebar;
  const M = () => window.RCSlab.materials;

  /**
   * 付着応力度の参考値 τoa [N/mm²]
   * σck から簡易補間（上書き可）
   */
  function defaultBondStress(sigmaCk) {
    const table = {
      21: 1.4,
      24: 1.6,
      27: 1.7,
      30: 1.8,
    };
    if (table[sigmaCk] != null) return table[sigmaCk];
    // 線形補間っぽく
    if (sigmaCk < 21) return 1.3;
    if (sigmaCk > 30) return 1.9;
    return 1.4 + ((sigmaCk - 21) / 9) * 0.4;
  }

  /**
   * 最小版厚
   * t ≥ max(tMinAbs, L_mm / spanDivisor)
   * 既定: 160 mm かつ L/30
   */
  function minThicknessCheck(opts) {
    const t_mm = opts.t_mm;
    const L_mm = opts.L_mm;
    const tMinAbs = opts.tMinAbs_mm ?? 160;
    const spanDiv = opts.spanDivisor ?? 30; // t ≥ L/spanDiv
    const tMinBySpan = L_mm > 0 && spanDiv > 0 ? L_mm / spanDiv : 0;
    const tMin = Math.max(tMinAbs, tMinBySpan);
    return {
      t_mm,
      tMinAbs,
      spanDivisor: spanDiv,
      tMinBySpan,
      tMin,
      ok: t_mm + 1e-6 >= tMin,
      formula: `t ≥ max(${tMinAbs}, L/${spanDiv}) = ${tMin.toFixed(1)} mm`,
    };
  }

  /**
   * 主鉄筋間隔の上下限
   * s ≤ min(maxSpacing, maxSpacingByT * t)
   * s ≥ max(minSpacing, minClear * φ) の簡易
   */
  function spacingCheck(opts) {
    const spacing = opts.spacing_mm;
    const t_mm = opts.t_mm;
    const phi = opts.barDiameter_mm || 0;
    const maxS = opts.maxSpacing ?? 300;
    const minS = opts.minSpacing ?? 100;
    const maxByTFactor = opts.maxSpacingByT ?? 1.5; // s ≤ 1.5 t（参考）
    const maxByT = maxByTFactor > 0 ? maxByTFactor * t_mm : Infinity;
    const maxAllow = Math.min(maxS, maxByT);
    const minByPhi = opts.minClearFactor != null ? opts.minClearFactor * phi : 0;
    const minAllow = Math.max(minS, minByPhi);

    const okMax = spacing <= maxAllow + 1e-6;
    const okMin = spacing + 1e-6 >= minAllow;
    return {
      spacing,
      maxAllow,
      minAllow,
      maxS,
      maxByT,
      maxByTFactor,
      minS,
      minByPhi,
      okMax,
      okMin,
      ok: okMax && okMin,
      note: !okMax
        ? "間隔が上限を超過"
        : !okMin
          ? "間隔が下限未満"
          : "",
    };
  }

  /**
   * 配力鉄筋（直交方向）の必要量と提案
   * As_dist,req = max(ratio * As_main, pDistMin * b * d)
   * 既定 ratio=0.3, pDistMin=0.001
   */
  function distributionRebar(opts) {
    const As_main = opts.As_main || 0;
    const b_mm = opts.b_mm;
    const d_mm = opts.d_mm;
    const ratio = opts.distRatio ?? 0.3;
    const pDistMin = opts.pDistMin ?? 0.001;
    const As_fromMain = ratio * As_main;
    const As_fromP = pDistMin * b_mm * d_mm;
    const As_req = Math.max(As_fromMain, As_fromP);

    let used;
    let proposal = { candidates: [], recommended: null };

    if (opts.mode === "manual") {
      const bar = M().getRebar(opts.barName);
      const spacing = opts.spacing_mm;
      if (bar && spacing > 0) {
        const As = rebar().providedAs(bar.area, spacing, b_mm);
        used = {
          name: bar.name,
          diameter: bar.diameter,
          barArea: bar.area,
          spacing,
          As,
          As_req,
          ok: As + 1e-6 >= As_req,
          note: "",
          source: "manual",
        };
      }
    } else {
      proposal = rebar().propose({
        As_req,
        b_mm,
        d_mm,
        maxSpacing: opts.maxSpacing ?? 300,
        minSpacing: opts.minSpacing ?? 100,
        step: 25,
        barNames: opts.barNames || ["D10", "D13", "D16"],
      });
      if (proposal.recommended) {
        used = { ...proposal.recommended, source: "auto" };
        used.As_req = As_req;
        used.ok = used.As + 1e-6 >= As_req;
      }
    }

    if (!used) {
      const bar = M().getRebar(opts.barName || "D13") || M().getRebar("D13");
      const spacing = opts.minSpacing || 100;
      const As = rebar().providedAs(bar.area, spacing, b_mm);
      used = {
        name: bar.name,
        diameter: bar.diameter,
        barArea: bar.area,
        spacing,
        As,
        As_req,
        ok: As + 1e-6 >= As_req,
        note: "適合案なし",
        source: "fallback",
      };
    }

    return {
      As_req,
      As_fromMain,
      As_fromP,
      ratio,
      pDistMin,
      used,
      proposal,
      ok: used.ok,
      formula: `As,dist ≥ max(${ratio}·As, ${pDistMin}·b·d)`,
    };
  }

  /**
   * 基本定着長・重ね継手長（参考）
   * ld = (σsa / (4 τoa)) · φ
   * 重ね継手 ls = lapFactor · ld（既定 1.0、引張重ねは 1.0〜1.3 を画面で調整）
   */
  function developmentLength(opts) {
    const phi = opts.barDiameter_mm;
    const sigmaSa = opts.sigmaSa;
    const tauOa =
      opts.tauOa != null && opts.tauOa > 0
        ? opts.tauOa
        : defaultBondStress(opts.sigmaCk);
    const lapFactor = opts.lapFactor ?? 1.0;

    if (!(phi > 0) || !(sigmaSa > 0) || !(tauOa > 0)) {
      return {
        ld_mm: 0,
        ls_mm: 0,
        tauOa,
        lapFactor,
        ok: false,
        formula: "—",
        note: "入力不足",
      };
    }

    const ld = (sigmaSa / (4 * tauOa)) * phi;
    const ls = lapFactor * ld;
    // 最低でも 20φ 程度は欲しい（参考下限）
    const ldMin = 20 * phi;
    const ld_use = Math.max(ld, ldMin);
    const ls_use = Math.max(ls, lapFactor * ldMin);

    return {
      ld_mm: ld_use,
      ld_calc_mm: ld,
      ldMin_mm: ldMin,
      ls_mm: ls_use,
      tauOa,
      lapFactor,
      phi,
      sigmaSa,
      ok: true,
      formula: `ld = max(σsa/(4τoa)·φ, 20φ),  ls = ${lapFactor}·ld`,
      note: "簡易式（参考）。定着位置・かぶり・横拘束は未考慮。",
    };
  }

  /**
   * まとめて実行
   */
  function runAll(ctx) {
    const thickness = minThicknessCheck({
      t_mm: ctx.t_mm,
      L_mm: ctx.L_mm,
      tMinAbs_mm: ctx.tMinAbs_mm,
      spanDivisor: ctx.spanDivisor,
    });

    const mainSpacing = spacingCheck({
      spacing_mm: ctx.mainSpacing_mm,
      t_mm: ctx.t_mm,
      barDiameter_mm: ctx.mainDiameter_mm,
      maxSpacing: ctx.maxSpacing,
      minSpacing: ctx.minSpacing,
      maxSpacingByT: ctx.maxSpacingByT,
      minClearFactor: ctx.minClearFactor ?? 1.0,
    });

    let compSpacing = null;
    if (ctx.compSpacing_mm != null && ctx.compDiameter_mm) {
      compSpacing = spacingCheck({
        spacing_mm: ctx.compSpacing_mm,
        t_mm: ctx.t_mm,
        barDiameter_mm: ctx.compDiameter_mm,
        maxSpacing: ctx.maxSpacing,
        minSpacing: ctx.minSpacing,
        maxSpacingByT: ctx.maxSpacingByT,
        minClearFactor: ctx.minClearFactor ?? 1.0,
      });
    }

    const dist = distributionRebar({
      As_main: ctx.As_main,
      b_mm: ctx.b_mm,
      d_mm: ctx.d_mm,
      distRatio: ctx.distRatio,
      pDistMin: ctx.pDistMin,
      mode: ctx.distMode || "auto",
      barName: ctx.distBarName,
      spacing_mm: ctx.distSpacing_mm,
      maxSpacing: ctx.maxSpacing,
      minSpacing: ctx.minSpacing,
    });

    const develop = developmentLength({
      barDiameter_mm: ctx.mainDiameter_mm,
      sigmaSa: ctx.sigmaSa,
      sigmaCk: ctx.sigmaCk,
      tauOa: ctx.tauOa,
      lapFactor: ctx.lapFactor,
    });

    let developComp = null;
    if (ctx.compDiameter_mm) {
      developComp = developmentLength({
        barDiameter_mm: ctx.compDiameter_mm,
        sigmaSa: ctx.sigmaSa,
        sigmaCk: ctx.sigmaCk,
        tauOa: ctx.tauOa,
        lapFactor: ctx.lapFactor,
      });
    }

    const ok =
      thickness.ok &&
      mainSpacing.ok &&
      (!compSpacing || compSpacing.ok) &&
      dist.ok &&
      develop.ok;

    return {
      thickness,
      mainSpacing,
      compSpacing,
      distribution: dist,
      development: develop,
      developmentComp: developComp,
      ok,
    };
  }

  return {
    defaultBondStress,
    minThicknessCheck,
    spacingCheck,
    distributionRebar,
    developmentLength,
    runAll,
  };
})();
