/**
 * 数値・単位の表示用フォーマット
 */
window.RCSlab = window.RCSlab || {};

window.RCSlab.format = (function () {
  function num(value, digits) {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    if (!Number.isFinite(value)) return "—";
    const d = digits === undefined ? 2 : digits;
    return Number(value).toLocaleString("ja-JP", {
      minimumFractionDigits: 0,
      maximumFractionDigits: d,
    });
  }

  function fixed(value, digits) {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";
    return Number(value).toFixed(digits);
  }

  /** N·mm → kN·m */
  function NmmToKNm(M_Nmm) {
    return M_Nmm / 1e6;
  }

  /** N → kN */
  function NToKN(V_N) {
    return V_N / 1000;
  }

  /** N/mm → kN/m */
  function NpmToKNpm(w) {
    return w;
  }

  function okNg(ok) {
    return ok ? "OK" : "NG";
  }

  function yesNo(ok) {
    return ok ? "適合" : "不適合";
  }

  return {
    num,
    fixed,
    NmmToKNm,
    NToKN,
    NpmToKNpm,
    okNg,
    yesNo,
  };
})();
