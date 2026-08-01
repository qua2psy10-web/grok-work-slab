/**
 * 設計計算書 HTML 生成
 */
window.RCSlab = window.RCSlab || {};

window.RCSlab.report = (function () {
  const F = () => window.RCSlab.format;

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function row(label, value) {
    return `<tr><th>${escapeHtml(label)}</th><td>${value}</td></tr>`;
  }

  function badge(ok) {
    return ok
      ? '<span class="badge badge-ok">OK</span>'
      : '<span class="badge badge-ng">NG</span>';
  }

  function build(result, meta) {
    if (!result || !result.ok) {
      const errs = (result && result.errors) || ["計算できません"];
      return `<div class="report-error"><p>計算書を生成できません。</p><ul>${errs
        .map((e) => `<li>${escapeHtml(e)}</li>`)
        .join("")}</ul></div>`;
    }

    const f = F();
    const m = meta || {};
    const L = result.input.L_m;
    const t = result.input.t_mm;
    const b = result.input.b_mm;
    const load = result.load;
    const fr = result.forces;
    const g = result.geometry;
    const req = result.required;
    const used = result.rebar.used;
    const usedC = result.rebar.usedComp;
    const bend = result.bending;
    const shr = result.shear;
    const minSt = result.minSteel;
    const mat = result.materials;
    const det = result.details;
    const isDouble = !!g.useDouble;
    const distU = det && det.distribution ? det.distribution.used : null;

    const title = escapeHtml(m.projectName || "RC床版 設計計算書");
    const bridge = escapeHtml(m.bridgeName || "—");
    const author = escapeHtml(m.author || "—");
    const date = escapeHtml(m.date || "—");
    const spanLabel = escapeHtml(m.spanLabel || "—");
    const notes = escapeHtml(m.notes || "");

    const sectionTypeLabel = {
      single: "単鉄筋",
      auto: "複鉄筋（必要時自動）",
      double: "複鉄筋（常時）",
    }[result.input.sectionType || "single"] || result.input.sectionType;

    const bendingSection = isDouble
      ? `
    <table class="data-table">
      ${row("設計断面", "複鉄筋矩形（許容応力度・弾性）")}
      ${row("つり合い抵抗モーメント M1", `${f.num(req.M1_kNm, 3)} kN·m`)}
      ${row("超過モーメント M2 = M − M1", `${f.num(req.M2_kNm, 3)} kN·m`)}
      ${row("必要引張鉄筋 As,req", `${f.num(req.As_req, 1)} mm²`)}
      ${row("必要圧縮鉄筋 As',req", `${f.num(req.AsPrime_req, 1)} mm²`)}
      ${row("使用配筋（引張）", `${escapeHtml(used.name)} @ ${f.num(used.spacing, 0)} mm`)}
      ${row("提供 As", `${f.num(used.As, 1)} mm²`)}
      ${row(
        "使用配筋（圧縮）",
        usedC
          ? `${escapeHtml(usedC.name)} @ ${f.num(usedC.spacing, 0)} mm`
          : "—"
      )}
      ${row("提供 As'", usedC ? `${f.num(usedC.As, 1)} mm²` : "—")}
      ${row("引張鉄筋比 p = As/(b d)", f.fixed(bend.p, 5))}
      ${row("圧縮鉄筋比 p' = As'/(b d)", f.fixed(bend.pPrime || 0, 5))}
      ${row("中立軸比 k", f.fixed(bend.k, 4))}
      ${row("アーム係数 j（参考）", f.fixed(bend.j, 4))}
      ${row("コンクリート応力度 σc", `${f.num(bend.sigmaC, 3)} N/mm² （許容 ${f.num(bend.sigmaCa, 2)}） ${badge(bend.okC)}`)}
      ${row("引張鉄筋応力度 σs", `${f.num(bend.sigmaS, 2)} N/mm² （許容 ${f.num(bend.sigmaSa, 0)}） ${badge(bend.okS)}`)}
      ${row("圧縮鉄筋応力度 σs'", `${f.num(bend.sigmaSPrime, 2)} N/mm² （許容 ${f.num(bend.sigmaSa, 0)}） ${badge(bend.okSPrime !== false)}`)}
      ${row("曲げ判定", badge(bend.ok))}
    </table>
    <p class="formula">
      つり合い: k = n/(n+σsa/σca),　M1 = ½·σca·k·j·b·d²<br>
      As = As1 + As2,　As2 = M2/(σsa·(d−d')),　As' = M2/(σs'·(d−d'))<br>
      応力度: 換算断面 I<sub>tr</sub> より σc = M·(kd)/I<sub>tr</sub>,　σs = n·M·(d−kd)/I<sub>tr</sub>,　σs' = n·M·(kd−d')/I<sub>tr</sub>
    </p>`
      : `
    <table class="data-table">
      ${row("設計断面", "単鉄筋矩形（許容応力度）")}
      ${row("必要鉄筋量 As,req", `${f.num(req.As_req, 1)} mm²`)}
      ${row("使用配筋", `${escapeHtml(used.name)} @ ${f.num(used.spacing, 0)} mm`)}
      ${row("提供鉄筋量 As", `${f.num(used.As, 1)} mm²`)}
      ${row("鉄筋比 p = As/(b d)", f.fixed(bend.p, 5))}
      ${row("中立軸比 k", f.fixed(bend.k, 4))}
      ${row("アーム係数 j", f.fixed(bend.j, 4))}
      ${row("コンクリート応力度 σc", `${f.num(bend.sigmaC, 3)} N/mm² （許容 ${f.num(bend.sigmaCa, 2)}） ${badge(bend.okC)}`)}
      ${row("鉄筋応力度 σs", `${f.num(bend.sigmaS, 2)} N/mm² （許容 ${f.num(bend.sigmaSa, 0)}） ${badge(bend.okS)}`)}
      ${row("曲げ判定", badge(bend.ok))}
    </table>
    <p class="formula">
      As,req ≈ M / (σsa · j · d)<br>
      σc = 2M / (k · j · b · d²)　／　σs = M / (As · j · d)
    </p>`;

    const rebarSection = isDouble
      ? `
    <table class="data-table">
      ${row("引張主鉄筋", `${escapeHtml(used.name)} を ${f.num(used.spacing, 0)} mm 間隔`)}
      ${row("引張 As（単位幅）", `${f.num(used.As, 1)} mm² / ${f.num(b, 0)} mm　${badge(used.ok)}`)}
      ${row(
        "圧縮主鉄筋",
        usedC
          ? `${escapeHtml(usedC.name)} を ${f.num(usedC.spacing, 0)} mm 間隔`
          : "—"
      )}
      ${row(
        "圧縮 As'（単位幅）",
        usedC
          ? `${f.num(usedC.As, 1)} mm² / ${f.num(b, 0)} mm　${badge(usedC.ok)}`
          : "—"
      )}
      ${row("最小鉄筋量 As,min（引張）", `${f.num(minSt.As_min, 1)} mm² （pmin=${f.fixed(minSt.pMin, 4)}） ${badge(minSt.ok)}`)}
    </table>`
      : `
    <table class="data-table">
      ${row("主鉄筋（設計方向）", `${escapeHtml(used.name)} を ${f.num(used.spacing, 0)} mm 間隔`)}
      ${row("1本あたり断面積", `${f.num(used.barArea, 2)} mm²`)}
      ${row("単位幅あたり As", `${f.num(used.As, 1)} mm² / ${f.num(b, 0)} mm`)}
      ${row("最小鉄筋量 As,min", `${f.num(minSt.As_min, 1)} mm² （pmin=${f.fixed(minSt.pMin, 4)}） ${badge(minSt.ok)}`)}
      ${row("配筋量の sufficiency", badge(used.ok))}
    </table>`;

    return `
<article class="report-doc">
  <header class="report-header">
    <h1>${title}</h1>
    <p class="report-sub">単純支持一方向 RC 床版（単位幅・単純梁モデル）／許容応力度設計（参考）</p>
    <table class="meta-table">
      ${row("橋梁名", bridge)}
      ${row("径間・位置", spanLabel)}
      ${row("作成者", author)}
      ${row("作成日", date)}
    </table>
  </header>

  <section>
    <h2>1. 設計条件</h2>
    <table class="data-table">
      ${row("支間長 L（主桁中心間隔）", `${f.num(L, 3)} m`)}
      ${row("設計幅 b", `${f.num(b, 0)} mm`)}
      ${row("床版厚 t", `${f.num(t, 0)} mm`)}
      ${row("かぶり c（引張側主鉄筋）", `${f.num(result.input.cover_mm, 0)} mm`)}
      ${
        isDouble
          ? row(
              "上側かぶり c'（圧縮側）",
              `${f.num(result.input.coverTop_mm, 0)} mm`
            )
          : ""
      }
      ${row("有効高さ d", `${f.num(g.d_mm, 1)} mm`)}
      ${row("d の算定", escapeHtml(g.formula_d))}
      ${
        isDouble && g.dPrime_mm != null
          ? row("圧縮鉄筋位置 d'", `${f.num(g.dPrime_mm, 1)} mm`) +
            row("d' の算定", escapeHtml(g.formula_dPrime || ""))
          : ""
      }
      ${row("断面形式（入力）", escapeHtml(sectionTypeLabel))}
      ${row("採用断面", isDouble ? "複鉄筋" : "単鉄筋")}
      ${row("構造モデル", "単純支持梁・等分布荷重・単位幅")}
    </table>
    <p class="note">本計算は道路橋示方書の全文準拠・認証を目的としたものではなく、単純梁理論に基づく補助・検算用です。</p>
  </section>

  <section>
    <h2>2. 材料</h2>
    <table class="data-table">
      ${row("コンクリート設計基準強度 σck", `${f.num(mat.concrete.sigmaCk, 0)} N/mm²`)}
      ${row("許容曲げ圧縮応力度 σca", `${f.num(mat.concrete.sigmaCa, 2)} N/mm²`)}
      ${row("許容せん断応力度 τa", `${f.num(mat.concrete.tauA, 3)} N/mm²`)}
      ${row("ヤング係数 Ec", `${f.num(mat.concrete.Ec, 0)} N/mm²`)}
      ${row("単位体積重量", `${f.num(mat.concrete.gamma, 1)} kN/m³`)}
      ${row("鉄筋種別", escapeHtml(mat.steel.name))}
      ${row("許容引張応力度 σsa", `${f.num(mat.steel.sigmaSa, 0)} N/mm²`)}
      ${row("ヤング係数比 n", `${f.num(mat.n, 2)}`)}
    </table>
  </section>

  <section>
    <h2>3. 荷重</h2>
    <table class="data-table">
      ${row("床版自重", `${f.num(load.slab_kNpm2, 3)} kN/m²`)}
      ${row("舗装", `${f.num(load.pav_kNpm2, 3)} kN/m²`)}
      ${row("付加死荷重", `${f.num(load.addl_kNpm2, 3)} kN/m²`)}
      ${row("死荷重合計 wd（面）", `${f.num(load.dead_kNpm2, 3)} kN/m²`)}
      ${row("活荷重 p（等分布等価）", `${f.num(load.live_kNpm2, 3)} kN/m²`)}
      ${row("衝撃係数 i", `${f.num(load.impact, 3)}`)}
      ${row("活荷重（衝撃込み）", `${f.num(load.liveWithImpact_kNpm2, 3)} kN/m²`)}
      ${row("設計線荷重 w（幅 b）", `${f.num(load.w_kNpm, 3)} kN/m`)}
    </table>
    <p class="formula">w = (死荷重 + 活荷重×(1+i)) × b　… 単位幅換算線荷重</p>
  </section>

  <section>
    <h2>4. 断面力</h2>
    <table class="data-table">
      ${row("曲げモーメント M = w L² / 8", `${f.num(fr.M_kNm, 3)} kN·m`)}
      ${row("せん断力 V = w L / 2", `${f.num(fr.V_kN, 3)} kN`)}
    </table>
    <p class="formula">
      M = ${f.num(load.w_kNpm, 3)} × ${f.num(L, 3)}² / 8 = ${f.num(fr.M_kNm, 3)} kN·m<br>
      V = ${f.num(load.w_kNpm, 3)} × ${f.num(L, 3)} / 2 = ${f.num(fr.V_kN, 3)} kN
    </p>
  </section>

  <section>
    <h2>5. 曲げ応力度に対する検討</h2>
    ${bendingSection}
  </section>

  <section>
    <h2>6. せん断応力度に対する検討</h2>
    <table class="data-table">
      ${row("せん断応力度 τ = V / (b j d)", `${f.num(shr.tau, 4)} N/mm²`)}
      ${row("許容せん断応力度 τa", `${f.num(shr.tauA, 3)} N/mm²`)}
      ${row("τ / τa", f.fixed(shr.ratio, 3))}
      ${row("せん断判定", badge(shr.ok))}
    </table>
  </section>

  <section>
    <h2>7. 配筋</h2>
    ${rebarSection}
  </section>

  <section>
    <h2>8. 詳細照査（参考）</h2>
    ${
      det
        ? `<table class="data-table">
      ${row("最小版厚", `t=${f.num(det.thickness.t_mm, 0)} mm ／ 必要 ${f.num(det.thickness.tMin, 1)} mm　${badge(det.thickness.ok)}`)}
      ${row("最小版厚の式", escapeHtml(det.thickness.formula))}
      ${row(
        "主鉄筋間隔",
        `${f.num(det.mainSpacing.spacing, 0)} mm（許容 ${f.num(det.mainSpacing.minAllow, 0)}〜${f.num(det.mainSpacing.maxAllow, 0)} mm） ${badge(det.mainSpacing.ok)}`
      )}
      ${
        det.compSpacing
          ? row(
              "圧縮鉄筋間隔",
              `${f.num(det.compSpacing.spacing, 0)} mm ${badge(det.compSpacing.ok)}`
            )
          : ""
      }
      ${row("配力 As,req", `${f.num(det.distribution.As_req, 1)} mm²`)}
      ${row("配力鉄筋の式", escapeHtml(det.distribution.formula))}
      ${row(
        "配力鉄筋",
        distU
          ? `${escapeHtml(distU.name)} @ ${f.num(distU.spacing, 0)} mm（As=${f.num(distU.As, 1)} mm²） ${badge(det.distribution.ok)}`
          : "—"
      )}
      ${row("付着応力度 τoa（参考）", `${f.num(det.development.tauOa, 2)} N/mm²`)}
      ${row("基本定着長 ld（主鉄筋）", `${f.num(det.development.ld_mm, 0)} mm`)}
      ${row("重ね継手長 ls（主鉄筋）", `${f.num(det.development.ls_mm, 0)} mm（係数 ${f.num(det.development.lapFactor, 2)}）`)}
      ${
        det.developmentComp
          ? row(
              "圧縮筋 ld / ls",
              `${f.num(det.developmentComp.ld_mm, 0)} / ${f.num(det.developmentComp.ls_mm, 0)} mm`
            )
          : ""
      }
      ${row("定着・継手の式", escapeHtml(det.development.formula))}
      ${row("詳細照査 総合", badge(det.ok))}
    </table>
    <p class="note">${escapeHtml(det.development.note || "簡易式による参考値です。")}</p>`
        : `<p class="note">詳細照査データなし</p>`
    }
  </section>

  <section>
    <h2>9. 判定一覧</h2>
    <table class="data-table check-table">
      ${row("曲げ（σc, σs" + (isDouble ? ", σs'" : "") + "）", badge(bend.ok))}
      ${row("せん断（τ）", badge(shr.ok))}
      ${row("最小鉄筋量", badge(minSt.ok))}
      ${row("必要引張鉄筋量の確保", badge(used.ok))}
      ${
        isDouble && usedC
          ? row("必要圧縮鉄筋量の確保", badge(usedC.ok))
          : ""
      }
      ${
        det
          ? row("最小版厚", badge(det.thickness.ok)) +
            row("主鉄筋間隔", badge(det.mainSpacing.ok)) +
            row("配力鉄筋量", badge(det.distribution.ok)) +
            row("詳細照査", badge(det.ok))
          : ""
      }
      ${row("総合判定", badge(result.overallOk))}
    </table>
    ${
      result.warnings && result.warnings.length
        ? `<div class="warnings"><h3>注意事項</h3><ul>${result.warnings
            .map((w) => `<li>${escapeHtml(w)}</li>`)
            .join("")}</ul></div>`
        : ""
    }
    ${notes ? `<div class="notes"><h3>備考</h3><p>${notes.replace(/\n/g, "<br>")}</p></div>` : ""}
  </section>

  <footer class="report-footer">
    <p>生成: RC床版設計補助ツール（許容応力度・単純梁モデル）／計算過程は画面入力に基づく自動算定です。</p>
  </footer>
</article>`;
  }

  return { build };
})();
