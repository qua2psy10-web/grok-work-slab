/**
 * Node 上で計算コアを読み込み代表ケースを検算する
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const files = [
  "js/format.js",
  "js/calc/materials.js",
  "js/calc/loads.js",
  "js/calc/section.js",
  "js/calc/bending.js",
  "js/calc/shear.js",
  "js/calc/rebar.js",
  "js/calc/detailChecks.js",
  "js/calc/design.js",
  "js/presets.js",
];

const context = { window: {}, console };
context.window = context;
vm.createContext(context);

for (const f of files) {
  const code = fs.readFileSync(path.join(root, f), "utf8");
  vm.runInContext(code, context, { filename: f });
}

const RC = context.window.RCSlab;
let failed = 0;

function assert(name, cond, detail) {
  if (cond) {
    console.log("PASS —", name, detail || "");
  } else {
    console.error("FAIL —", name, detail || "");
    failed++;
  }
}

function approx(a, b, tol) {
  return Math.abs(a - b) <= (tol ?? 1e-6);
}

assert(
  "M = wL²/8",
  approx(RC.bending.simpleBeamMoment(10, 3000), 11.25e6, 1)
);
assert("V = wL/2", approx(RC.shear.simpleBeamShear(10, 3000), 15000, 1));
assert("d", approx(RC.section.effectiveDepth(200, 30, 16), 162, 1e-9));
assert(
  "d'",
  approx(RC.section.compressionDepth(30, 13), 36.5, 1e-9)
);
assert("As D16@125", approx(RC.rebar.providedAs(198.6, 125, 1000), 1588.8, 0.1));

// --- 単鉄筋: k 公式 ---
{
  const n = 15;
  const p = 0.01;
  const { k, j } = RC.section.kj(n, p);
  const kExpect = Math.sqrt((n * p) ** 2 + 2 * n * p) - n * p;
  assert("kj single", approx(k, kExpect, 1e-9) && j > 0.8 && j < 1);
}

// --- 複鉄筋: As'=0 で単鉄筋 k と一致 ---
{
  const n = 15;
  const p = 0.01;
  const { k: k1 } = RC.section.kj(n, p);
  const { k: k2 } = RC.section.kDouble(n, p, 0, 0.2);
  assert("kDouble As'=0 → single", approx(k1, k2, 1e-9), `k1=${k1} k2=${k2}`);
}

// --- 複鉄筋: 必要量（手計算） ---
// n=15, σca=8, σsa=180, b=1000, d=160, d'=35
// k = 15/(15+180/8) = 15/(15+22.5) = 15/37.5 = 0.4
// j = 1 - 0.4/3 = 0.8666...
// M1 = 0.5*8*0.4*0.866666*1000*160^2 = 0.5*8*0.4*(13/15)*1000*25600
{
  const n = 15;
  const sigmaCa = 8;
  const sigmaSa = 180;
  const b = 1000;
  const d = 160;
  const dP = 35;
  const bal = RC.section.balancedSection(n, sigmaCa, sigmaSa, b, d);
  assert("k_bal=0.4", approx(bal.k, 0.4, 1e-9), "k=" + bal.k);
  assert("j_bal≈0.8667", approx(bal.j, 1 - 0.4 / 3, 1e-9));

  // M を M1 の 1.3 倍にして複鉄筋にする
  const M = bal.M1_Nmm * 1.3;
  const req = RC.bending.requiredAsDouble(
    M,
    sigmaCa,
    sigmaSa,
    b,
    d,
    dP,
    n
  );
  assert("req double mode", req.mode === "double", req.mode);
  assert("As'_req > 0", req.AsPrime_req > 0, String(req.AsPrime_req));
  assert("As_req > As1", req.As_req > bal.As1, `As=${req.As_req} As1=${bal.As1}`);

  const lever = d - dP;
  const M2 = M - bal.M1_Nmm;
  const As2Expect = M2 / (sigmaSa * lever);
  assert("As2", approx(req.As2, As2Expect, 0.1), `As2=${req.As2}`);

  // 応力度: ちょうど必要量を入れたとき σ は許容付近
  const st = RC.bending.stressesDouble(
    M,
    req.As_req,
    req.AsPrime_req,
    b,
    d,
    dP,
    n
  );
  assert("double stress finite", Number.isFinite(st.sigmaC) && st.sigmaC > 0);
  assert(
    "double σc ≤ σca (approx)",
    st.sigmaC <= sigmaCa * 1.05 + 1e-6,
    `σc=${st.sigmaC}`
  );
  assert(
    "double σs ≤ σsa (approx)",
    st.sigmaS <= sigmaSa * 1.05 + 1e-6,
    `σs=${st.sigmaS}`
  );
  console.log(
    "  → double hand: M1=",
    (bal.M1_Nmm / 1e6).toFixed(3),
    "M=",
    (M / 1e6).toFixed(3),
    "As=",
    req.As_req.toFixed(1),
    "As'=",
    req.AsPrime_req.toFixed(1),
    "σc=",
    st.sigmaC.toFixed(3),
    "σs=",
    st.sigmaS.toFixed(2),
    "σs'=",
    st.sigmaSPrime.toFixed(2)
  );
}

// M ≤ M1 → single
{
  const bal = RC.section.balancedSection(15, 8, 180, 1000, 160);
  const req = RC.bending.requiredAsDouble(
    bal.M1_Nmm * 0.5,
    8,
    180,
    1000,
    160,
    35,
    15
  );
  assert("M<M1 → single", req.mode === "single" && req.AsPrime_req === 0);
}

const baseInput = {
  L_m: 3.0,
  t_mm: 200,
  b_mm: 1000,
  cover_mm: 30,
  coverTop_mm: 30,
  sectionType: "single",
  sigmaCk: 24,
  sigmaCa: 8,
  tauA: 0.39,
  Ec: 25000,
  gamma_c: 24.5,
  steelGrade: "SD345",
  sigmaSa: 180,
  Es: 200000,
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
  tMinAbs_mm: 160,
  spanDivisor: 30,
  maxSpacingByT: 1.5,
  distRatio: 0.3,
  pDistMin: 0.001,
  lapFactor: 1.0,
  tauOa: "",
  distMode: "auto",
  distBarName: "D13",
  distSpacing_mm: 200,
};

// --- 詳細照査ユニット ---
{
  const th = RC.detailChecks.minThicknessCheck({
    t_mm: 200,
    L_mm: 3000,
    tMinAbs_mm: 160,
    spanDivisor: 30,
  });
  assert("tmin=160", approx(th.tMin, 160, 0.1) && th.ok);

  const th2 = RC.detailChecks.minThicknessCheck({
    t_mm: 100,
    L_mm: 3000,
    tMinAbs_mm: 160,
    spanDivisor: 30,
  });
  assert("tmin NG", !th2.ok);

  // ld = 180/(4*1.6)*16 = 180/6.4*16 = 450, 20φ=320 → 450
  const dev = RC.detailChecks.developmentLength({
    barDiameter_mm: 16,
    sigmaSa: 180,
    sigmaCk: 24,
    tauOa: 1.6,
    lapFactor: 1.0,
  });
  assert("ld≈450", approx(dev.ld_mm, 450, 0.5), "ld=" + dev.ld_mm);
  assert("ls≈450", approx(dev.ls_mm, 450, 0.5));

  const dist = RC.detailChecks.distributionRebar({
    As_main: 1000,
    b_mm: 1000,
    d_mm: 160,
    distRatio: 0.3,
    pDistMin: 0.001,
    mode: "auto",
    maxSpacing: 300,
    minSpacing: 100,
  });
  assert("dist As_req=300", approx(dist.As_req, 300, 0.1) || dist.As_req >= 160);
  // max(0.3*1000, 0.001*1000*160)=max(300,160)=300
  assert("dist As_req exact 300", approx(dist.As_req, 300, 0.1));
  assert("dist used ok", dist.ok && dist.used.As >= 300 - 1);
}

// presets
{
  assert("builtin presets", RC.presets.listBuiltin().length >= 3);
  const p = RC.presets.getBuiltin("default");
  assert("default preset", !!p && p.data.L_m === 3.0);
}

const r = RC.design.run(baseInput);
assert("design.run ok", r.ok === true, (r.errors || []).join(";"));
if (r.ok) {
  assert("w≈19.2", approx(r.load.w_kNpm, 19.2, 0.05), "w=" + r.load.w_kNpm);
  assert("M≈21.6", approx(r.forces.M_kNm, 21.6, 0.05), "M=" + r.forces.M_kNm);
  assert("As_req>0", r.required.As_req > 0, String(r.required.As_req));
  assert("used rebar", !!r.rebar.used && r.rebar.used.As > 0);
  assert("default single", r.geometry.useDouble === false);
  assert("details present", !!r.details);
  assert("details thickness ok", r.details.thickness.ok);
  assert("details dist ok", r.details.distribution.ok);
  assert("details develop ld>0", r.details.development.ld_mm > 0);
  console.log(
    "  → 使用配筋:",
    r.rebar.used.name,
    "@",
    r.rebar.used.spacing,
    "As=",
    r.rebar.used.As.toFixed(1)
  );
  console.log(
    "  → 配力:",
    r.details.distribution.used.name,
    "@",
    r.details.distribution.used.spacing,
    "As,dist=",
    r.details.distribution.used.As.toFixed(1)
  );
  console.log(
    "  → ld=",
    r.details.development.ld_mm.toFixed(0),
    "ls=",
    r.details.development.ls_mm.toFixed(0)
  );
  console.log(
    "  → σc=",
    r.bending.sigmaC.toFixed(3),
    "σs=",
    r.bending.sigmaS.toFixed(2),
    "τ=",
    r.shear.tau.toFixed(4)
  );
  console.log("  → overallOk=", r.overallOk);
}

// 薄い版 + 大荷重で複鉄筋自動切替
const heavy = RC.design.run({
  ...baseInput,
  sectionType: "auto",
  t_mm: 160,
  live_kNpm2: 25,
  impact: 0.4,
  L_m: 3.5,
});
assert("heavy design ok", heavy.ok === true, (heavy.errors || []).join(";"));
if (heavy.ok) {
  console.log(
    "  → heavy: M=",
    heavy.forces.M_kNm.toFixed(2),
    "M1=",
    heavy.required.M1_kNm.toFixed(2),
    "useDouble=",
    heavy.geometry.useDouble,
    "As'=",
    heavy.required.AsPrime_req.toFixed(1)
  );
  if (heavy.geometry.useDouble) {
    assert("heavy has As'", heavy.required.AsPrime_req > 0);
    assert("heavy has usedComp", !!heavy.rebar.usedComp);
    assert(
      "heavy σs' defined",
      Number.isFinite(heavy.bending.sigmaSPrime)
    );
  } else {
    // もし単鉄筋で足りるなら M ≤ M1
    assert(
      "heavy single implies M≤M1",
      heavy.forces.M_Nmm <= heavy.required.M1_Nmm * 1.001
    );
  }
}

// 強制複鉄筋 + 手動配筋
const forced = RC.design.run({
  ...baseInput,
  sectionType: "double",
  t_mm: 150,
  live_kNpm2: 30,
  impact: 0.4,
  L_m: 4.0,
  rebarMode: "manual",
  barName: "D19",
  spacing_mm: 100,
  rebarModeComp: "manual",
  barNameComp: "D13",
  spacingComp_mm: 125,
});
assert("forced double run ok", forced.ok === true, (forced.errors || []).join(";"));
if (forced.ok) {
  console.log(
    "  → forced: useDouble=",
    forced.geometry.useDouble,
    "M=",
    forced.forces.M_kNm.toFixed(2),
    "M1=",
    forced.required.M1_kNm.toFixed(2),
    "σc=",
    forced.bending.sigmaC.toFixed(3),
    "overall=",
    forced.overallOk
  );
  if (forced.geometry.useDouble) {
    assert("forced usedComp", !!forced.rebar.usedComp);
    assert(
      "forced As' manual",
      approx(
        forced.rebar.usedComp.As,
        RC.rebar.providedAs(126.7, 125, 1000),
        0.5
      )
    );
  }
}

// 単鉄筋と As'=0 複鉄筋 stress の一致
{
  const M = 20e6;
  const As = 1000;
  const s1 = RC.bending.stresses(M, As, 1000, 160, 15);
  const s2 = RC.bending.stressesDouble(M, As, 0, 1000, 160, 35, 15);
  assert(
    "stress single == double As'=0 (σc)",
    approx(s1.sigmaC, s2.sigmaC, 1e-6),
    `s1=${s1.sigmaC} s2=${s2.sigmaC}`
  );
  assert(
    "stress single == double As'=0 (σs)",
    approx(s1.sigmaS, s2.sigmaS, 1e-6)
  );
}

if (failed) {
  console.error("\nFailed:", failed);
  process.exit(1);
}
console.log("\nAll checks passed.");
