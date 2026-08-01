/**
 * 入力プリセット定義 + localStorage / JSON 入出力
 */
window.RCSlab = window.RCSlab || {};

window.RCSlab.presets = (function () {
  const STORAGE_KEY = "rc-slab-design-saved-cases-v1";
  const VERSION = 1;

  /**
   * 組み込みプリセット（設計入力の一部または全部）
   * apply 時は materials の σca 等は UI 側で σck 連動してもよい
   */
  const BUILTIN = [
    {
      id: "default",
      name: "標準（単純床版デモ）",
      description: "L=3 m, t=200 mm, 活荷重 10 kN/m², i=0.25",
      data: {
        projectName: "RC床版 設計計算書",
        L_m: 3.0,
        t_mm: 200,
        b_mm: 1000,
        cover_mm: 30,
        coverTop_mm: 30,
        sectionType: "auto",
        sigmaCk: 24,
        steelGrade: "SD345",
        useFixedN: true,
        nFixed: 15,
        pavement_mm: 80,
        gamma_p: 22.5,
        addl_dead_kNpm2: 0,
        live_kNpm2: 10,
        impact: 0.25,
        rebarMode: "auto",
        barName: "D16",
        spacing_mm: 125,
        rebarModeComp: "auto",
        barNameComp: "D13",
        spacingComp_mm: 150,
        maxSpacing: 300,
        minSpacing: 100,
        pMin: 0.002,
        // 詳細照査
        tMinAbs_mm: 160,
        spanDivisor: 30,
        maxSpacingByT: 1.5,
        distMode: "auto",
        distBarName: "D13",
        distSpacing_mm: 200,
        distRatio: 0.3,
        pDistMin: 0.001,
        lapFactor: 1.0,
        tauOa: "", // 空なら自動
      },
    },
    {
      id: "bridge_ref",
      name: "道示寄り参考（中桁間）",
      description: "L=2.8 m, t=220 mm, 舗装80, 活荷重12, i=0.3, σck24/SD345",
      data: {
        projectName: "RC床版 設計計算書（参考プリセット）",
        bridgeName: "",
        spanLabel: "主桁間床版",
        L_m: 2.8,
        t_mm: 220,
        b_mm: 1000,
        cover_mm: 35,
        coverTop_mm: 35,
        sectionType: "auto",
        sigmaCk: 24,
        steelGrade: "SD345",
        useFixedN: true,
        nFixed: 15,
        pavement_mm: 80,
        gamma_p: 22.5,
        addl_dead_kNpm2: 0.5,
        live_kNpm2: 12,
        impact: 0.3,
        rebarMode: "auto",
        barName: "D16",
        spacing_mm: 125,
        rebarModeComp: "auto",
        barNameComp: "D13",
        spacingComp_mm: 150,
        maxSpacing: 300,
        minSpacing: 100,
        pMin: 0.002,
        tMinAbs_mm: 160,
        spanDivisor: 30,
        maxSpacingByT: 1.5,
        distMode: "auto",
        distBarName: "D13",
        distSpacing_mm: 200,
        distRatio: 0.3,
        pDistMin: 0.001,
        lapFactor: 1.0,
        tauOa: "",
      },
    },
    {
      id: "long_span",
      name: "やや長支間",
      description: "L=3.5 m, t=230 mm, 活荷重12, i=0.25",
      data: {
        projectName: "RC床版 設計計算書（長支間）",
        L_m: 3.5,
        t_mm: 230,
        b_mm: 1000,
        cover_mm: 35,
        coverTop_mm: 35,
        sectionType: "auto",
        sigmaCk: 27,
        steelGrade: "SD345",
        useFixedN: true,
        nFixed: 15,
        pavement_mm: 80,
        gamma_p: 22.5,
        addl_dead_kNpm2: 0,
        live_kNpm2: 12,
        impact: 0.25,
        rebarMode: "auto",
        barName: "D16",
        spacing_mm: 125,
        rebarModeComp: "auto",
        barNameComp: "D13",
        spacingComp_mm: 150,
        maxSpacing: 300,
        minSpacing: 100,
        pMin: 0.002,
        tMinAbs_mm: 160,
        spanDivisor: 30,
        maxSpacingByT: 1.5,
        distMode: "auto",
        distBarName: "D13",
        distSpacing_mm: 200,
        distRatio: 0.3,
        pDistMin: 0.001,
        lapFactor: 1.0,
        tauOa: "",
      },
    },
    {
      id: "double_demo",
      name: "複鉄筋デモ（薄い版・大荷重）",
      description: "L=3.5 m, t=160 mm, 活荷重25 — 複鉄筋自動切替の確認用",
      data: {
        projectName: "RC床版 複鉄筋デモ",
        L_m: 3.5,
        t_mm: 160,
        b_mm: 1000,
        cover_mm: 30,
        coverTop_mm: 30,
        sectionType: "auto",
        sigmaCk: 24,
        steelGrade: "SD345",
        useFixedN: true,
        nFixed: 15,
        pavement_mm: 80,
        gamma_p: 22.5,
        addl_dead_kNpm2: 0,
        live_kNpm2: 25,
        impact: 0.4,
        rebarMode: "auto",
        barName: "D19",
        spacing_mm: 100,
        rebarModeComp: "auto",
        barNameComp: "D13",
        spacingComp_mm: 125,
        maxSpacing: 300,
        minSpacing: 100,
        pMin: 0.002,
        tMinAbs_mm: 160,
        spanDivisor: 30,
        maxSpacingByT: 1.5,
        distMode: "auto",
        distBarName: "D13",
        distSpacing_mm: 150,
        distRatio: 0.3,
        pDistMin: 0.001,
        lapFactor: 1.0,
        tauOa: "",
      },
    },
  ];

  function listBuiltin() {
    return BUILTIN.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
    }));
  }

  function getBuiltin(id) {
    return BUILTIN.find((p) => p.id === id) || null;
  }

  function readStore() {
    try {
      if (typeof localStorage === "undefined") return [];
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.cases) ? parsed.cases : [];
    } catch (e) {
      return [];
    }
  }

  function writeStore(cases) {
    if (typeof localStorage === "undefined") return false;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: VERSION, cases })
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  function listSaved() {
    return readStore().map((c) => ({
      id: c.id,
      name: c.name,
      savedAt: c.savedAt,
    }));
  }

  function getSaved(id) {
    return readStore().find((c) => c.id === id) || null;
  }

  function saveCase(name, data) {
    const cases = readStore();
    const id =
      "case_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 7);
    const entry = {
      id,
      name: name || "無題の条件",
      savedAt: new Date().toISOString(),
      version: VERSION,
      data: { ...data },
    };
    cases.unshift(entry);
    // 上限 30 件
    while (cases.length > 30) cases.pop();
    writeStore(cases);
    return entry;
  }

  function deleteCase(id) {
    const cases = readStore().filter((c) => c.id !== id);
    writeStore(cases);
    return true;
  }

  function exportJson(payload) {
    return JSON.stringify(
      {
        app: "rc-slab-design",
        version: VERSION,
        exportedAt: new Date().toISOString(),
        ...payload,
      },
      null,
      2
    );
  }

  function parseImport(text) {
    const obj = JSON.parse(text);
    if (obj.data && typeof obj.data === "object") {
      return { name: obj.name || "インポート", data: obj.data };
    }
    // 生の入力オブジェクト
    if (obj.L_m != null || obj.t_mm != null) {
      return { name: obj.projectName || "インポート", data: obj };
    }
    throw new Error("認識できない JSON 形式です");
  }

  return {
    VERSION,
    STORAGE_KEY,
    listBuiltin,
    getBuiltin,
    listSaved,
    getSaved,
    saveCase,
    deleteCase,
    exportJson,
    parseImport,
  };
})();
