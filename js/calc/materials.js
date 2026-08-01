/**
 * 材料定数テーブル（許容応力度設計の参考値）
 * 道路橋示方書の全文を再現したものではなく、教育・補助用の代表値です。
 * 画面上で上書き可能。
 */
window.RCSlab = window.RCSlab || {};

window.RCSlab.materials = (function () {
  /** 鉄筋公称断面積 [mm²] と公称径 [mm] */
  const REBAR_TYPES = [
    { name: "D10", diameter: 10, area: 71.33 },
    { name: "D13", diameter: 13, area: 126.7 },
    { name: "D16", diameter: 16, area: 198.6 },
    { name: "D19", diameter: 19, area: 286.5 },
    { name: "D22", diameter: 22, area: 387.1 },
    { name: "D25", diameter: 25, area: 506.7 },
  ];

  /**
   * コンクリート参考値
   * σca: 許容曲げ圧縮応力度 [N/mm²]
   * τa: 許容せん断応力度（斜め引張）[N/mm²] 簡易値
   * Ec: ヤング係数 [N/mm²]
   * gamma: 単位体積重量 [kN/m³]
   */
  const CONCRETE = {
    21: { sigmaCk: 21, sigmaCa: 7.0, tauA: 0.36, Ec: 23500, gamma: 24.5 },
    24: { sigmaCk: 24, sigmaCa: 8.0, tauA: 0.39, Ec: 25000, gamma: 24.5 },
    27: { sigmaCk: 27, sigmaCa: 9.0, tauA: 0.42, Ec: 26500, gamma: 24.5 },
    30: { sigmaCk: 30, sigmaCa: 10.0, tauA: 0.45, Ec: 28000, gamma: 24.5 },
  };

  /**
   * 鉄筋参考値
   * sigmaSa: 許容引張応力度 [N/mm²]（一般の床版主鉄筋想定の代表値）
   */
  const STEEL = {
    SD295: { name: "SD295", sigmaSa: 140, Es: 200000 },
    SD345: { name: "SD345", sigmaSa: 180, Es: 200000 },
  };

  /** ヤング係数比の上限（従来慣用 n=15） */
  const DEFAULT_N = 15;

  function getConcrete(sigmaCk) {
    const key = String(sigmaCk);
    return CONCRETE[key] ? { ...CONCRETE[key] } : null;
  }

  function getSteel(grade) {
    return STEEL[grade] ? { ...STEEL[grade] } : null;
  }

  function listConcreteKeys() {
    return Object.keys(CONCRETE).map(Number);
  }

  function listSteelKeys() {
    return Object.keys(STEEL);
  }

  function getRebar(name) {
    return REBAR_TYPES.find((r) => r.name === name) || null;
  }

  function modularRatio(Ec, Es, useFixedN, fixedN) {
    if (useFixedN) return fixedN || DEFAULT_N;
    if (!Ec || Ec <= 0) return DEFAULT_N;
    const n = (Es || 200000) / Ec;
    return Math.min(n, 15); // 慣用上 15 を上限とすることが多い
  }

  return {
    REBAR_TYPES,
    CONCRETE,
    STEEL,
    DEFAULT_N,
    getConcrete,
    getSteel,
    listConcreteKeys,
    listSteelKeys,
    getRebar,
    modularRatio,
  };
})();
