/**
 * 配筋提案（単位幅あたり）
 */
window.RCSlab = window.RCSlab || {};

window.RCSlab.rebar = (function () {
  const mats = () => window.RCSlab.materials;

  /**
   * 単位幅 b [mm] に対し、間隔 s [mm] のとき本数相当 As
   * As = (b / s) * A_bar
   */
  function providedAs(barArea_mm2, spacing_mm, b_mm) {
    if (spacing_mm <= 0) return 0;
    return (b_mm / spacing_mm) * barArea_mm2;
  }

  /**
   * 必要 As を満たす最大間隔（切り下げ）
   * s <= b * A_bar / As_req
   */
  function maxSpacingForAs(barArea_mm2, As_req, b_mm) {
    if (As_req <= 0) return Infinity;
    return (b_mm * barArea_mm2) / As_req;
  }

  /**
   * 配筋候補を列挙
   * @param {object} opts
   * @param {number} opts.As_req
   * @param {number} opts.b_mm
   * @param {number} opts.d_mm
   * @param {number} [opts.maxSpacing=300]
   * @param {number} [opts.minSpacing=75]
   * @param {number} [opts.step=25]
   * @param {string[]} [opts.barNames]
   */
  function propose(opts) {
    const As_req = opts.As_req;
    const b = opts.b_mm;
    const maxS = opts.maxSpacing ?? 300;
    const minS = opts.minSpacing ?? 75;
    const step = opts.step ?? 25;
    const names = opts.barNames || ["D13", "D16", "D19", "D22"];
    const candidates = [];

    for (const name of names) {
      const bar = mats().getRebar(name);
      if (!bar) continue;
      const sMaxByAs = maxSpacingForAs(bar.area, As_req, b);
      // 許容最大間隔を step で切り下げ
      let s = Math.floor(Math.min(maxS, sMaxByAs) / step) * step;
      if (s < minS) {
        // 最小間隔でも不足なら最小で登録（不足フラグ）
        const As = providedAs(bar.area, minS, b);
        candidates.push({
          name: bar.name,
          diameter: bar.diameter,
          barArea: bar.area,
          spacing: minS,
          As,
          As_req,
          ok: As + 1e-6 >= As_req && minS <= maxS,
          note: As + 1e-6 < As_req ? "鉄筋量不足" : sMaxByAs < minS ? "間隔過密" : "",
        });
        continue;
      }
      if (s > maxS) s = maxS;
      // より密な間隔も数点出す
      const spacings = new Set([s]);
      if (s - step >= minS) spacings.add(s - step);
      // 丸め後に不足しないよう、足りなければ step ずつ詰める
      let ss = s;
      while (providedAs(bar.area, ss, b) < As_req - 1e-6 && ss - step >= minS) {
        ss -= step;
        spacings.add(ss);
      }
      for (const spacing of spacings) {
        const As = providedAs(bar.area, spacing, b);
        candidates.push({
          name: bar.name,
          diameter: bar.diameter,
          barArea: bar.area,
          spacing,
          As,
          As_req,
          ok: As + 1e-6 >= As_req && spacing >= minS && spacing <= maxS,
          note: As + 1e-6 < As_req ? "鉄筋量不足" : "",
        });
      }
    }

    // 合格を As 余裕が小さく（経済的）、同程度なら太い径・広い間隔優先
    const okList = candidates.filter((c) => c.ok);
    okList.sort((a, b) => {
      const ra = a.As / Math.max(As_req, 1e-9);
      const rb = b.As / Math.max(As_req, 1e-9);
      if (Math.abs(ra - rb) > 0.02) return ra - rb;
      return b.spacing - a.spacing;
    });
    const recommended = okList[0] || null;

    // 表示用: 推奨を先頭に、径ごとに代表を並べる
    const unique = [];
    const seen = new Set();
    if (recommended) {
      unique.push(recommended);
      seen.add(`${recommended.name}@${recommended.spacing}`);
    }
    for (const c of candidates.sort((a, b) => a.diameter - b.diameter || a.spacing - b.spacing)) {
      const key = `${c.name}@${c.spacing}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(c);
      if (unique.length >= 12) break;
    }

    return { candidates: unique, recommended };
  }

  /**
   * 最小鉄筋量の簡易チェック
   * p_min 既定 0.002（0.2%）— 参考値、上書き可
   */
  function minSteelCheck(As_mm2, b_mm, d_mm, pMin) {
    const pmin = pMin ?? 0.002;
    const As_min = pmin * b_mm * d_mm;
    return {
      pMin: pmin,
      As_min,
      As: As_mm2,
      ok: As_mm2 + 1e-6 >= As_min,
    };
  }

  return {
    providedAs,
    maxSpacingForAs,
    propose,
    minSteelCheck,
  };
})();
