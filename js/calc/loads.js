/**
 * 荷重計算（単位幅あたり）
 * 内部単位: 線荷重 w [N/mm]（= kN/m と同じ数値）
 */
window.RCSlab = window.RCSlab || {};

window.RCSlab.loads = (function () {
  /**
   * @param {object} input
   * @param {number} input.t_mm - 床版厚 [mm]
   * @param {number} input.b_mm - 設計幅 [mm]
   * @param {number} input.gamma_c - コンクリート単位体積重量 [kN/m³]
   * @param {number} input.pavement_mm - 舗装厚 [mm]
   * @param {number} input.gamma_p - 舗装単位体積重量 [kN/m³]
   * @param {number} input.addl_dead_kNpm2 - 付加死荷重 [kN/m²]
   * @param {number} input.live_kNpm2 - 活荷重（等分布等価）[kN/m²]
   * @param {number} input.impact - 衝撃係数 i
   */
  function compute(input) {
    const t = input.t_mm;
    const b = input.b_mm;
    const b_m = b / 1000;
    const t_m = t / 1000;
    const pav_m = (input.pavement_mm || 0) / 1000;

    // 面荷重 [kN/m²]
    const slab_kNpm2 = input.gamma_c * t_m;
    const pav_kNpm2 = (input.gamma_p || 22.5) * pav_m;
    const addl_kNpm2 = input.addl_dead_kNpm2 || 0;
    const dead_kNpm2 = slab_kNpm2 + pav_kNpm2 + addl_kNpm2;

    const live_kNpm2 = input.live_kNpm2 || 0;
    const impact = input.impact || 0;
    const liveWithImpact_kNpm2 = live_kNpm2 * (1 + impact);

    // 単位幅あたり線荷重 [kN/m] = [N/mm]
    const wd = dead_kNpm2 * b_m;
    const wl = live_kNpm2 * b_m;
    const wl_i = liveWithImpact_kNpm2 * b_m;
    const w = wd + wl_i;

    return {
      slab_kNpm2,
      pav_kNpm2,
      addl_kNpm2,
      dead_kNpm2,
      live_kNpm2,
      impact,
      liveWithImpact_kNpm2,
      wd_kNpm: wd,
      wl_kNpm: wl,
      wl_i_kNpm: wl_i,
      w_kNpm: w,
      /** 設計に用いる等分布線荷重 [N/mm]（数値は kN/m と同じ） */
      w_Nmm: w,
      wd_Nmm: wd,
      wl_i_Nmm: wl_i,
    };
  }

  return { compute };
})();
