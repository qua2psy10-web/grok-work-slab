/**
 * せん断応力度照査
 * V = w L / 2（支点）
 * τ = V / (b · j · d)
 */
window.RCSlab = window.RCSlab || {};

window.RCSlab.shear = (function () {
  /**
   * @param {number} w_Nmm - 線荷重 [N/mm]
   * @param {number} L_mm - 支間 [mm]
   * @returns {number} V [N]
   */
  function simpleBeamShear(w_Nmm, L_mm) {
    return (w_Nmm * L_mm) / 2;
  }

  /**
   * @param {number} V_N
   * @param {number} b_mm
   * @param {number} d_mm
   * @param {number} j - 曲げから得た j（なければ 7/8）
   */
  function shearStress(V_N, b_mm, d_mm, j) {
    const jj = j && j > 0 ? j : 7 / 8;
    if (b_mm <= 0 || d_mm <= 0) return Infinity;
    return V_N / (b_mm * jj * d_mm);
  }

  function check(V_N, b_mm, d_mm, j, tauA) {
    const tau = shearStress(V_N, b_mm, d_mm, j);
    const ok = tau <= tauA + 1e-9;
    return {
      tau,
      tauA,
      j: j && j > 0 ? j : 7 / 8,
      ok,
      ratio: tauA > 0 ? tau / tauA : Infinity,
    };
  }

  return {
    simpleBeamShear,
    shearStress,
    check,
  };
})();
