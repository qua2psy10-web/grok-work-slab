/**
 * 曲げモーメント・応力度照査（単鉄筋／複鉄筋矩形・許容応力度）
 * M の単位: N·mm, As: mm², 応力度: N/mm²
 */
window.RCSlab = window.RCSlab || {};

window.RCSlab.bending = (function () {
  const section = () => window.RCSlab.section;

  /**
   * 単純梁等分布: M = w L² / 8
   * @param {number} w_Nmm - 線荷重 [N/mm]（= kN/m）
   * @param {number} L_mm - 支間 [mm]
   * @returns {number} M [N·mm]
   */
  function simpleBeamMoment(w_Nmm, L_mm) {
    return (w_Nmm * L_mm * L_mm) / 8;
  }

  /**
   * 必要鉄筋量（単鉄筋・反復で j を更新）
   * As = M / (σsa · j · d)
   */
  function requiredAs(M_Nmm, sigmaSa, b_mm, d_mm, n, maxIter) {
    if (d_mm <= 0 || sigmaSa <= 0 || M_Nmm <= 0) {
      return { As_req: 0, AsPrime_req: 0, j: 7 / 8, k: 0, iterations: 0, mode: "single" };
    }
    let j = 7 / 8;
    let k = 0;
    let As = M_Nmm / (sigmaSa * j * d_mm);
    const iters = maxIter || 10;
    for (let i = 0; i < iters; i++) {
      const p = section().steelRatio(As, b_mm, d_mm);
      const kj = section().kj(n, p);
      k = kj.k;
      j = kj.j > 0 ? kj.j : j;
      As = M_Nmm / (sigmaSa * j * d_mm);
    }
    return {
      As_req: As,
      AsPrime_req: 0,
      j,
      k,
      iterations: iters,
      mode: "single",
      M1_Nmm: null,
      M2_Nmm: 0,
    };
  }

  /**
   * 複鉄筋の必要鉄筋量（つり合い断面 + 超過モーメントを圧縮鉄筋偶力で負担）
   *
   * M1 = (1/2) σca k j b d²  （つり合い断面の抵抗モーメント）
   * As1 = p_bal · b · d
   * M2 = M − M1
   * As2 = M2 / (σsa (d − d'))
   * As  = As1 + As2
   * σs' = n · σca · (k − γ) / k   （つり合い k 上の圧縮鉄筋応力度）
   * As' = M2 / (min(σs', σsa) · (d − d'))
   *
   * M ≤ M1 のときは単鉄筋の必要量に帰着（As'=0）
   */
  function requiredAsDouble(M_Nmm, sigmaCa, sigmaSa, b_mm, d_mm, dPrime_mm, n) {
    if (d_mm <= 0 || sigmaSa <= 0 || M_Nmm <= 0 || b_mm <= 0) {
      return {
        As_req: 0,
        AsPrime_req: 0,
        j: 7 / 8,
        k: 0,
        mode: "single",
        M1_Nmm: 0,
        M2_Nmm: 0,
        As1: 0,
        As2: 0,
        sigmaSPrime_des: 0,
        gamma: 0,
      };
    }

    const bal = section().balancedSection(n, sigmaCa, sigmaSa, b_mm, d_mm);
    const gamma = d_mm > 0 ? dPrime_mm / d_mm : 0;
    const lever = d_mm - dPrime_mm;

    // 圧縮鉄筋が圧縮域に入らない、またはレバーアームが無効
    if (!(lever > 0) || bal.k <= gamma + 1e-9) {
      const single = requiredAs(M_Nmm, sigmaSa, b_mm, d_mm, n);
      return {
        ...single,
        mode: "single",
        M1_Nmm: bal.M1_Nmm,
        M2_Nmm: 0,
        As1: bal.As1,
        As2: 0,
        sigmaSPrime_des: 0,
        gamma,
        note: "d' またはつり合い k の条件により複鉄筋設計不可 → 単鉄筋",
      };
    }

    if (M_Nmm <= bal.M1_Nmm + 1e-6) {
      const single = requiredAs(M_Nmm, sigmaSa, b_mm, d_mm, n);
      return {
        ...single,
        mode: "single",
        M1_Nmm: bal.M1_Nmm,
        M2_Nmm: 0,
        As1: bal.As1,
        As2: 0,
        sigmaSPrime_des: 0,
        gamma,
        note: "M ≤ M1（つり合い）のため単鉄筋で足りる",
      };
    }

    const M2 = M_Nmm - bal.M1_Nmm;
    const As2 = M2 / (sigmaSa * lever);
    const As_req = bal.As1 + As2;

    // つり合い断面上の圧縮鉄筋応力度（弾性）
    let sigmaSPrime = (n * sigmaCa * (bal.k - gamma)) / bal.k;
    if (sigmaSPrime < 0) sigmaSPrime = 0;
    const sigmaSPrime_des = Math.min(sigmaSPrime, sigmaSa);
    const AsPrime_req =
      sigmaSPrime_des > 0 ? M2 / (sigmaSPrime_des * lever) : Infinity;

    return {
      As_req,
      AsPrime_req,
      j: bal.j,
      k: bal.k,
      mode: "double",
      M1_Nmm: bal.M1_Nmm,
      M2_Nmm: M2,
      As1: bal.As1,
      As2,
      sigmaSPrime,
      sigmaSPrime_des,
      gamma,
      note: "",
    };
  }

  /**
   * 与えられた As に対する応力度（単鉄筋）
   * σc = 2M / (k j b d²)
   * σs = M / (As j d)
   */
  function stresses(M_Nmm, As_mm2, b_mm, d_mm, n) {
    if (As_mm2 <= 0 || d_mm <= 0 || b_mm <= 0) {
      return {
        p: 0,
        pPrime: 0,
        k: 0,
        j: 0,
        sigmaC: Infinity,
        sigmaS: Infinity,
        sigmaSPrime: 0,
        mode: "single",
      };
    }
    const p = section().steelRatio(As_mm2, b_mm, d_mm);
    const { k, j } = section().kj(n, p);
    const sigmaC = (2 * M_Nmm) / (k * j * b_mm * d_mm * d_mm);
    const sigmaS = M_Nmm / (As_mm2 * j * d_mm);
    return {
      p,
      pPrime: 0,
      k,
      j,
      sigmaC,
      sigmaS,
      sigmaSPrime: 0,
      mode: "single",
    };
  }

  /**
   * 複鉄筋の応力度（換算断面二次モーメント法）
   * I_tr について中立軸まわり
   * σc  = M · (kd) / I_tr
   * σs  = n · M · (d − kd) / I_tr
   * σs' = n · M · (kd − d') / I_tr
   *
   * As' = 0 のときは単鉄筋公式にフォールバック（数値同一性）
   */
  function stressesDouble(M_Nmm, As_mm2, AsPrime_mm2, b_mm, d_mm, dPrime_mm, n) {
    if (!(AsPrime_mm2 > 0)) {
      return stresses(M_Nmm, As_mm2, b_mm, d_mm, n);
    }
    if (As_mm2 <= 0 || d_mm <= 0 || b_mm <= 0) {
      return {
        p: 0,
        pPrime: 0,
        k: 0,
        j: 0,
        sigmaC: Infinity,
        sigmaS: Infinity,
        sigmaSPrime: Infinity,
        mode: "double",
        I_tr: 0,
        gamma: d_mm > 0 ? dPrime_mm / d_mm : 0,
      };
    }

    const p = section().steelRatio(As_mm2, b_mm, d_mm);
    const pPrime = section().steelRatio(AsPrime_mm2, b_mm, d_mm);
    const gamma = dPrime_mm / d_mm;
    const { k, j } = section().kDouble(n, p, pPrime, gamma);

    if (!(k > 0) || k >= 1) {
      return {
        p,
        pPrime,
        k,
        j,
        sigmaC: Infinity,
        sigmaS: Infinity,
        sigmaSPrime: Infinity,
        mode: "double",
        I_tr: 0,
        gamma,
        note: "中立軸比 k が不正です",
      };
    }

    const I_tr = section().transformedI(
      b_mm,
      d_mm,
      k,
      n,
      As_mm2,
      AsPrime_mm2,
      dPrime_mm
    );
    if (!(I_tr > 0)) {
      return {
        p,
        pPrime,
        k,
        j,
        sigmaC: Infinity,
        sigmaS: Infinity,
        sigmaSPrime: Infinity,
        mode: "double",
        I_tr: 0,
        gamma,
      };
    }

    const kd = k * d_mm;
    const sigmaC = (M_Nmm * kd) / I_tr;
    const sigmaS = (n * M_Nmm * (d_mm - kd)) / I_tr;
    // 圧縮鉄筋が引張域側にある場合は符号が負 → 絶対値で評価し警告
    const sigmaSPrimeRaw = (n * M_Nmm * (kd - dPrime_mm)) / I_tr;
    const sigmaSPrime = Math.abs(sigmaSPrimeRaw);

    return {
      p,
      pPrime,
      k,
      j,
      sigmaC,
      sigmaS,
      sigmaSPrime,
      sigmaSPrimeRaw,
      mode: "double",
      I_tr,
      gamma,
      compressionSteelInTension: sigmaSPrimeRaw < 0,
    };
  }

  function check(M_Nmm, As_mm2, b_mm, d_mm, n, sigmaCa, sigmaSa) {
    const s = stresses(M_Nmm, As_mm2, b_mm, d_mm, n);
    const okC = s.sigmaC <= sigmaCa + 1e-9;
    const okS = s.sigmaS <= sigmaSa + 1e-9;
    return {
      ...s,
      sigmaCa,
      sigmaSa,
      okC,
      okS,
      okSPrime: true,
      ok: okC && okS,
      ratioC: sigmaCa > 0 ? s.sigmaC / sigmaCa : Infinity,
      ratioS: sigmaSa > 0 ? s.sigmaS / sigmaSa : Infinity,
      ratioSPrime: 0,
    };
  }

  function checkDouble(
    M_Nmm,
    As_mm2,
    AsPrime_mm2,
    b_mm,
    d_mm,
    dPrime_mm,
    n,
    sigmaCa,
    sigmaSa
  ) {
    const s = stressesDouble(
      M_Nmm,
      As_mm2,
      AsPrime_mm2,
      b_mm,
      d_mm,
      dPrime_mm,
      n
    );
    const okC = s.sigmaC <= sigmaCa + 1e-9;
    const okS = s.sigmaS <= sigmaSa + 1e-9;
    const okSPrime =
      !(AsPrime_mm2 > 0) || s.sigmaSPrime <= sigmaSa + 1e-9;
    const okGeom = !s.compressionSteelInTension;
    return {
      ...s,
      sigmaCa,
      sigmaSa,
      okC,
      okS,
      okSPrime,
      okGeom,
      ok: okC && okS && okSPrime && okGeom,
      ratioC: sigmaCa > 0 ? s.sigmaC / sigmaCa : Infinity,
      ratioS: sigmaSa > 0 ? s.sigmaS / sigmaSa : Infinity,
      ratioSPrime:
        sigmaSa > 0 && AsPrime_mm2 > 0 ? s.sigmaSPrime / sigmaSa : 0,
    };
  }

  return {
    simpleBeamMoment,
    requiredAs,
    requiredAsDouble,
    stresses,
    stressesDouble,
    check,
    checkDouble,
  };
})();
