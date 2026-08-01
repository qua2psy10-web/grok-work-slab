/**
 * 断面幾何・単鉄筋／複鉄筋矩形の中立軸係数
 */
window.RCSlab = window.RCSlab || {};

window.RCSlab.section = (function () {
  /**
   * 引張鉄筋有効高さ d [mm]
   * 主鉄筋1段: d = t - c - φ/2
   */
  function effectiveDepth(t_mm, cover_mm, barDiameter_mm) {
    return t_mm - cover_mm - barDiameter_mm / 2;
  }

  /**
   * 圧縮鉄筋位置 d' [mm]
   * 圧縮縁からかぶり＋半径: d' = c' + φ'/2
   */
  function compressionDepth(coverTop_mm, barDiameter_mm) {
    return coverTop_mm + barDiameter_mm / 2;
  }

  /**
   * 鉄筋比 p = As / (b d)
   */
  function steelRatio(As_mm2, b_mm, d_mm) {
    if (b_mm <= 0 || d_mm <= 0) return 0;
    return As_mm2 / (b_mm * d_mm);
  }

  /**
   * 単鉄筋矩形の k, j
   * k = sqrt( (n p)^2 + 2 n p ) - n p
   * j = 1 - k/3
   */
  function kj(n, p) {
    if (p <= 0 || n <= 0) {
      return { k: 0, j: 7 / 8, np: 0 };
    }
    const np = n * p;
    const k = Math.sqrt(np * np + 2 * np) - np;
    const j = 1 - k / 3;
    return { k, j, np };
  }

  /**
   * 複鉄筋矩形の中立軸比 k（弾性・換算断面）
   *
   * 力のつり合い（圧縮コンクリート + (n−1)As' = 引張 n As）:
   *   k²/2 + (n−1) p' (k − γ) = n p (1 − k)
   *   ただし γ = d'/d, p = As/(bd), p' = As'/(bd)
   *
   * → k² + 2[(n−1)p' + n p] k − 2[(n−1)p' γ + n p] = 0
   */
  function kDouble(n, p, pPrime, gamma) {
    if (n <= 0) return { k: 0, j: 7 / 8 };
    if (!(pPrime > 0) || !(gamma >= 0)) {
      return kj(n, p);
    }
    if (!(p > 0)) {
      // 圧縮鉄筋のみは非対応（床版主筋設計では想定外）
      return { k: 0, j: 7 / 8 };
    }

    const a = 1;
    const bCoef = 2 * ((n - 1) * pPrime + n * p);
    const cCoef = -2 * ((n - 1) * pPrime * gamma + n * p);
    const disc = bCoef * bCoef - 4 * a * cCoef;
    if (disc < 0) {
      return kj(n, p);
    }
    const k = (-bCoef + Math.sqrt(disc)) / (2 * a);
    // 等価アーム係数（せん断用の便宜値）: 引張鋼重心まわりの圧縮合力アーム / d
    // j ≈ 1 − k/3 は単鉄筋近似。複鉄筋では I 法で応力度を出すため j は参考値。
    const j = k > 0 && k < 1 ? 1 - k / 3 : 7 / 8;
    return { k, j, np: n * p, npPrime: (n - 1) * pPrime };
  }

  /**
   * 換算断面二次モーメント（中立軸まわり）[mm⁴]
   * I_tr = b (kd)³/3 + (n−1) As' (kd − d')² + n As (d − kd)²
   */
  function transformedI(b_mm, d_mm, k, n, As_mm2, AsPrime_mm2, dPrime_mm) {
    if (k <= 0 || d_mm <= 0 || b_mm <= 0) return 0;
    const kd = k * d_mm;
    let I = (b_mm * Math.pow(kd, 3)) / 3;
    if (AsPrime_mm2 > 0 && n > 1) {
      const armC = kd - dPrime_mm;
      I += (n - 1) * AsPrime_mm2 * armC * armC;
    }
    if (As_mm2 > 0 && n > 0) {
      const armT = d_mm - kd;
      I += n * As_mm2 * armT * armT;
    }
    return I;
  }

  /**
   * つり合い鉄筋比（許容応力度・単鉄筋）
   * k_bal = n / (n + σsa/σca)
   * p_bal = (σca / (2 σsa)) * k_bal
   */
  function balancedRatio(n, sigmaCa, sigmaSa) {
    if (sigmaSa <= 0 || sigmaCa <= 0 || n <= 0) return 0;
    const k = n / (n + sigmaSa / sigmaCa);
    const p = (k * sigmaCa) / (2 * sigmaSa);
    return p;
  }

  /**
   * つり合い断面の k, j, M1, As1
   */
  function balancedSection(n, sigmaCa, sigmaSa, b_mm, d_mm) {
    if (sigmaSa <= 0 || sigmaCa <= 0 || n <= 0 || b_mm <= 0 || d_mm <= 0) {
      return { k: 0, j: 7 / 8, p: 0, As1: 0, M1_Nmm: 0 };
    }
    const k = n / (n + sigmaSa / sigmaCa);
    const j = 1 - k / 3;
    const p = (k * sigmaCa) / (2 * sigmaSa);
    const As1 = p * b_mm * d_mm;
    const M1_Nmm = 0.5 * sigmaCa * k * j * b_mm * d_mm * d_mm;
    return { k, j, p, As1, M1_Nmm };
  }

  return {
    effectiveDepth,
    compressionDepth,
    steelRatio,
    kj,
    kDouble,
    transformedI,
    balancedRatio,
    balancedSection,
  };
})();
