const TRADING_DAYS = 252;
const palette = ["#2563eb", "#0f9f8f", "#df4f67", "#b7791f", "#6d5dfc", "#168a4a", "#475569"];

const formatPct = (value, digits = 1) => Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : "-";
const formatNum = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : "-";
const money = (value) => Number.isFinite(value) ? value.toLocaleString("ko-KR", { maximumFractionDigits: 0 }) : "-";
const compactWon = (value) => {
  if (!Number.isFinite(value) || value <= 0) return "N/A";
  if (value >= 100000000) return `${(value / 100000000).toFixed(2)}억원`;
  if (value >= 10000) return `${(value / 10000).toFixed(0)}만원`;
  return `${money(value)}원`;
};

const schemaAliases = {
  date: [/^date$/i, /time/i, /일자/, /날짜/, /기준일/, /거래일/],
  asset: [/ticker/i, /symbol/i, /asset/i, /name/i, /종목/, /자산/, /상품/, /펀드/],
  close: [/close/i, /price/i, /nav/i, /종가/, /가격/, /기준가/, /현재가/],
  return: [/return/i, /^ret$/i, /수익률/, /등락률/, /변화율/],
  weight: [/weight/i, /allocation/i, /비중/, /편입/, /배분/],
  value: [/value/i, /amount/i, /market/i, /평가금액/, /금액/, /잔고/, /평가액/],
  volume: [/volume/i, /turnover/i, /거래량/, /거래대금/, /유동성/]
};

const schemaLabels = {
  date: "시간 축",
  asset: "자산 식별자",
  close: "가격",
  return: "수익률",
  weight: "비중",
  value: "평가금액",
  volume: "거래량/거래대금"
};

const skillChecklist = [
  "컬럼명과 데이터 타입을 확인한다.",
  "날짜, 자산, 가격, 수익률, 비중, 평가금액을 감지한다.",
  "수익률과 비중의 직접 계산 또는 대체 계산 방식을 선택한다.",
  "성과, 위험, 배분, 상관 지표를 동일 기준으로 산출한다.",
  "데이터 조건에 맞는 차트와 인사이트를 생성한다."
];

let charts = {};
let currentRows = [];
let currentName = "멀티에셋 포트폴리오";
let currentScenario = "portfolio";

function seededNoise(i, seed) {
  const raw = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return raw - Math.floor(raw);
}

function createScenarioRows(kind) {
  if (kind === "korean") return createKoreanColumnRows();
  if (kind === "incomplete") return createIncompleteRows();

  const start = new Date("2024-01-02T00:00:00");
  const assetsByKind = {
    portfolio: [
      ["US Growth", 0.34, 100, 0.00072, 0.012],
      ["Korea Value", 0.22, 86, 0.00038, 0.014],
      ["Global Bond", 0.24, 102, 0.00018, 0.004],
      ["Gold Hedge", 0.12, 72, 0.00029, 0.009],
      ["Cash", 0.08, 1, 0.00004, 0.0004]
    ],
    etf: [
      ["AI Semiconductor ETF", 0.32, 64, 0.00095, 0.017],
      ["Healthcare ETF", 0.18, 51, 0.00044, 0.010],
      ["Dividend ETF", 0.22, 47, 0.00031, 0.007],
      ["Treasury ETF", 0.18, 92, 0.00012, 0.004],
      ["Commodity ETF", 0.10, 38, 0.00022, 0.012]
    ],
    single: [
      ["Alpha Motors", 1, 125, 0.00055, 0.021]
    ]
  };

  return buildSyntheticRows(assetsByKind[kind], kind === "single" ? 260 : 320, start);
}

function buildSyntheticRows(assets, days, start) {
  const rows = [];
  assets.forEach(([asset, weight, base, drift, vol], assetIndex) => {
    let close = base;
    for (let i = 0; i < days; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      const cycle = Math.sin(i / (18 + assetIndex * 4)) * vol * 0.55;
      const shock = (seededNoise(i, assetIndex + 3) - 0.5) * vol * 1.15;
      const event = i > 170 && i < 195 && assetIndex < 2 ? -vol * 0.32 : 0;
      const dailyReturn = drift + cycle + shock + event;
      close = Math.max(0.1, close * (1 + dailyReturn));
      rows.push({
        date: date.toISOString().slice(0, 10),
        ticker: asset,
        close: Number(close.toFixed(3)),
        return: Number(dailyReturn.toFixed(6)),
        weight,
        value: Number((100000000 * weight * close / base).toFixed(0)),
        volume: Math.round(50000 + Math.abs(shock) * 9000000 + assetIndex * 12000)
      });
    }
  });
  return rows;
}

function createKoreanColumnRows() {
  const base = buildSyntheticRows([
    ["국내성장주", 0.42, 74000, 0.00055, 0.014],
    ["미국배당ETF", 0.31, 52000, 0.00036, 0.009],
    ["단기채권", 0.27, 10100, 0.00008, 0.003]
  ], 240, new Date("2024-02-01T00:00:00"));

  return base.map((row) => ({
    일자: row.date,
    종목명: row.ticker,
    종가: row.close,
    평가금액: row.value,
    거래대금: row.volume
  }));
}

function createIncompleteRows() {
  const start = new Date("2024-08-01T00:00:00");
  const assets = [
    ["Momentum", 118, 0.010],
    ["Low Vol", 92, 0.006]
  ];
  const rows = [];
  assets.forEach(([asset, base, vol], assetIndex) => {
    let price = base;
    for (let i = 0; i < 72; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      const wave = Math.sin(i / 5 + assetIndex) * vol * 0.75;
      const shock = (seededNoise(i, assetIndex + 13) - 0.5) * vol * 1.8;
      const event = i > 30 && i < 38 ? -vol * 0.8 : 0;
      price = Math.max(1, price * (1 + wave + shock + event));
      rows.push({
        date: date.toISOString().slice(0, 10),
        asset,
        price: rows.length % 19 === 0 ? "" : Number(price.toFixed(3))
      });
    }
  });
  return rows;
}

function parseCsv(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter((line) => line.trim());
  if (lines.length < 2) throw new Error("CSV에는 헤더와 데이터 행이 필요합니다.");
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = (values[index] ?? "").trim();
      return row;
    }, {});
  });
}

function splitCsvLine(line) {
  const output = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === "," && !quoted) {
      output.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  output.push(cell);
  return output;
}

function detectSchema(rows) {
  const headers = Object.keys(rows[0] || {});
  const findByAlias = (key) => headers.find((h) => schemaAliases[key].some((pattern) => pattern.test(String(h))));
  const schema = {
    date: findByAlias("date"),
    asset: findByAlias("asset"),
    close: findByAlias("close"),
    return: findByAlias("return"),
    weight: findByAlias("weight"),
    value: findByAlias("value"),
    volume: findByAlias("volume")
  };

  if (!schema.date) {
    schema.date = headers.find((h) => rows.some((r) => parseDate(r[h])));
  }
  if (!schema.close && !schema.return) {
    schema.close = headers.find((h) => numericCoverage(rows, h) > 0.7);
  }
  return schema;
}

function normalizeRows(rows, schema) {
  const normalized = rows.map((row, index) => {
    const parsedDate = schema.date ? parseDate(row[schema.date]) : new Date(Date.now() + index * 86400000);
    return {
      date: parsedDate ? parsedDate.toISOString().slice(0, 10) : null,
      asset: schema.asset ? String(row[schema.asset] || "단일 자산").trim() : "단일 자산",
      close: schema.close ? parseNumber(row[schema.close]) : NaN,
      explicitReturn: schema.return ? parsePercentLike(row[schema.return]) : NaN,
      weight: schema.weight ? parseNumber(row[schema.weight]) : NaN,
      value: schema.value ? parseNumber(row[schema.value]) : NaN,
      volume: schema.volume ? parseNumber(row[schema.volume]) : NaN,
      raw: row
    };
  }).filter((row) => row.date && row.asset);

  const byAsset = groupBy(normalized, (row) => row.asset);
  Object.values(byAsset).forEach((items) => {
    items.sort((a, b) => a.date.localeCompare(b.date));
    items.forEach((row, index) => {
      const previous = items[index - 1];
      if (Number.isFinite(row.explicitReturn)) {
        row.return = row.explicitReturn;
        row.returnSource = "direct";
      } else if (previous && Number.isFinite(row.close) && Number.isFinite(previous.close) && previous.close !== 0) {
        row.return = row.close / previous.close - 1;
        row.returnSource = "price";
      } else {
        row.return = 0;
        row.returnSource = "missing";
      }
    });
  });
  return normalized;
}

function analyze(rows) {
  const schema = detectSchema(rows);
  const normalized = normalizeRows(rows, schema);
  const assets = [...new Set(normalized.map((row) => row.asset))];
  const dates = [...new Set(normalized.map((row) => row.date))].sort();
  const byAsset = groupBy(normalized, (row) => row.asset);
  const latestByAsset = Object.values(byAsset).map((items) => items.at(-1)).filter(Boolean);
  const weightResult = buildWeightMap(latestByAsset, assets);
  const seriesByDate = dates.map((date) => {
    const dayRows = normalized.filter((row) => row.date === date);
    const dailyReturn = sum(dayRows.map((row) => (weightResult.weights[row.asset] || 0) * row.return));
    return { date, return: dailyReturn };
  });
  const equity = [];
  let base = 100;
  seriesByDate.forEach((point) => {
    base *= 1 + point.return;
    equity.push({ date: point.date, value: base });
  });

  const returns = seriesByDate.map((point) => point.return).filter(Number.isFinite);
  const totalReturn = equity.length ? equity.at(-1).value / 100 - 1 : 0;
  const years = Math.max(returns.length / TRADING_DAYS, 1 / TRADING_DAYS);
  const annualReturn = Math.pow(Math.max(0.0001, 1 + totalReturn), 1 / years) - 1;
  const volatility = std(returns) * Math.sqrt(TRADING_DAYS);
  const sharpe = volatility ? annualReturn / volatility : 0;
  const drawdowns = calcDrawdowns(equity);
  const maxDrawdown = drawdowns.length ? Math.min(...drawdowns.map((d) => d.drawdown), 0) : 0;
  const assetStats = assets.map((asset) => calcAssetStats(byAsset[asset] || [], weightResult.weights[asset] || 0));
  const corr = calcCorrelationMatrix(assets, normalized);
  const fallbackRules = buildFallbackRules(schema, normalized, assets, weightResult.source);
  const quality = qualityChecks(rows, schema, normalized, assets, fallbackRules);
  const insights = buildInsights({ totalReturn, annualReturn, volatility, sharpe, maxDrawdown, assetStats, corr, quality, assets });
  const confidence = calcConfidence(schema, normalized, assets, fallbackRules);

  return {
    schema,
    normalized,
    assets,
    dates,
    latestByAsset,
    weights: weightResult.weights,
    weightSource: weightResult.source,
    equity,
    returns,
    annualReturn,
    totalReturn,
    volatility,
    sharpe,
    drawdowns,
    maxDrawdown,
    assetStats,
    corr,
    fallbackRules,
    quality,
    insights,
    confidence
  };
}

function buildWeightMap(latestByAsset, assets) {
  const usableWeights = latestByAsset.length && latestByAsset.every((row) => Number.isFinite(row.weight) && row.weight > 0);
  if (usableWeights) {
    const total = sum(latestByAsset.map((row) => row.weight));
    return { source: "weight", weights: Object.fromEntries(latestByAsset.map((row) => [row.asset, row.weight / total])) };
  }

  const usableValues = latestByAsset.length && latestByAsset.every((row) => Number.isFinite(row.value) && row.value > 0);
  if (usableValues) {
    const total = sum(latestByAsset.map((row) => row.value));
    return { source: "market_value", weights: Object.fromEntries(latestByAsset.map((row) => [row.asset, row.value / total])) };
  }

  return { source: "equal_weight", weights: Object.fromEntries(assets.map((asset) => [asset, assets.length ? 1 / assets.length : 0])) };
}

function buildFallbackRules(schema, normalized, assets, weightSource) {
  const rules = [];
  const returnSources = new Set(normalized.map((row) => row.returnSource));
  if (!schema.return && schema.close) rules.push({ type: "info", label: "가격 기반 수익률", text: "수익률 컬럼이 없어 가격 변화율로 일간 수익률을 계산했습니다." });
  if (returnSources.has("missing")) rules.push({ type: "warn", label: "수익률 일부 대체", text: "가격 또는 수익률이 없는 일부 행은 0% 수익률로 처리했습니다." });
  if (weightSource === "market_value") rules.push({ type: "info", label: "평가금액 비중", text: "비중 컬럼이 없어 최신 평가금액으로 자산 비중을 계산했습니다." });
  if (weightSource === "equal_weight") rules.push({ type: "warn", label: "동일 비중 가정", text: "비중과 평가금액이 없어 동일 비중 포트폴리오로 분석했습니다." });
  if (assets.length === 1) rules.push({ type: "warn", label: "단일 자산", text: "자산이 1개라 상관 히트맵은 제한하고 개별 리스크 중심으로 분석합니다." });
  if (new Set(normalized.map((row) => row.date)).size < 30) rules.push({ type: "warn", label: "관측치 부족", text: "관측일이 30일 미만이면 변동성, Sharpe, 상관계수 해석 신뢰도가 낮습니다." });
  if (!rules.length) rules.push({ type: "ok", label: "직접 계산", text: "필수 컬럼을 감지해 대체 규칙 없이 분석했습니다." });
  return rules;
}

function calcAssetStats(rows, weight) {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const returns = sorted.map((row) => row.return).filter(Number.isFinite);
  const closeStart = sorted.find((row) => Number.isFinite(row.close))?.close;
  const closeEnd = [...sorted].reverse().find((row) => Number.isFinite(row.close))?.close;
  const totalReturn = Number.isFinite(closeStart) && Number.isFinite(closeEnd) && closeStart !== 0
    ? closeEnd / closeStart - 1
    : compound(returns) - 1;
  return {
    asset: sorted[0]?.asset || "자산",
    weight,
    return: totalReturn,
    volatility: std(returns) * Math.sqrt(TRADING_DAYS),
    latestValue: sorted.at(-1)?.value,
    observations: sorted.length
  };
}

function calcDrawdowns(equity) {
  let peak = 100;
  return equity.map((point) => {
    peak = Math.max(peak, point.value);
    return { date: point.date, drawdown: point.value / peak - 1 };
  });
}

function calcCorrelationMatrix(assets, rows) {
  const byAsset = groupBy(rows, (row) => row.asset);
  const returnsByAsset = Object.fromEntries(assets.map((asset) => [asset, (byAsset[asset] || []).map((row) => row.return)]));
  return assets.map((a) => assets.map((b) => a === b ? 1 : corr(returnsByAsset[a], returnsByAsset[b])));
}

function qualityChecks(rawRows, schema, normalized, assets, fallbackRules) {
  const checks = [];
  const required = [["date", "시간 축"], ["asset", "자산 식별자"], ["close", "가격"], ["return", "수익률"]];
  required.forEach(([key, label]) => {
    if (schema[key]) checks.push({ level: "ok", text: `${label} 컬럼 감지: ${schema[key]}` });
    else if (key === "asset") checks.push({ level: "warn", text: "자산 식별자 컬럼이 없어 단일 자산으로 처리합니다." });
    else if (key === "return" && schema.close) checks.push({ level: "ok", text: "수익률 컬럼 미감지: 가격 변화율로 대체합니다." });
    else checks.push({ level: "warn", text: `${label} 컬럼을 감지하지 못했습니다.` });
  });

  const usedRows = normalized.length;
  const excludedRows = rawRows.length - usedRows;
  if (excludedRows > 0) checks.push({ level: "warn", text: `원본 ${rawRows.length.toLocaleString()}행 중 ${excludedRows.toLocaleString()}행을 제외했습니다.` });
  const observationDays = new Set(normalized.map((row) => row.date)).size;
  checks.push({ level: observationDays >= 30 ? "ok" : "warn", text: `분석 관측일: ${observationDays.toLocaleString()}일` });
  checks.push({ level: assets.length >= 2 ? "ok" : "warn", text: assets.length >= 2 ? `${assets.length}개 자산의 상관 구조를 계산합니다.` : "단일 자산 데이터로 상관 분석을 제한합니다." });
  fallbackRules.filter((rule) => rule.type === "warn").forEach((rule) => checks.push({ level: "warn", text: rule.text }));
  return checks;
}

function buildInsights(ctx) {
  const insights = [];
  const best = [...ctx.assetStats].sort((a, b) => b.return - a.return)[0];
  const riskiest = [...ctx.assetStats].sort((a, b) => b.volatility - a.volatility)[0];
  const concentration = ctx.assetStats.length ? Math.max(...ctx.assetStats.map((a) => a.weight)) : 0;
  const corrValues = ctx.corr.flat().filter((v) => Number.isFinite(v) && v < 0.999);
  const avgCorr = corrValues.length ? average(corrValues) : NaN;

  insights.push({
    type: ctx.sharpe >= 1 ? "opportunity" : "neutral",
    title: "위험 대비 성과",
    text: `분석 기간 누적 수익률은 ${formatPct(ctx.totalReturn)}, 연율 변동성은 ${formatPct(ctx.volatility)}, Sharpe Ratio는 ${formatNum(ctx.sharpe)}입니다. ${ctx.sharpe >= 1 ? "위험 대비 성과가 양호한 구간으로 해석됩니다." : "위험 대비 성과는 보수적으로 해석할 필요가 있습니다."}`
  });

  insights.push({
    type: ctx.maxDrawdown <= -0.2 ? "risk" : "neutral",
    title: "최대 낙폭",
    text: `최대 낙폭은 ${formatPct(ctx.maxDrawdown)}입니다. ${ctx.maxDrawdown <= -0.2 ? "손실 방어 조건이나 리밸런싱 기준을 함께 검토해야 합니다." : "기준 경고선인 -20% 이내에서 손실 구간이 관찰됩니다."}`
  });

  if (best) {
    insights.push({
      type: "opportunity",
      title: "성과 기여 자산",
      text: `${best.asset}의 기간 수익률이 ${formatPct(best.return)}로 가장 높습니다. 해당 자산은 성과 기여도 검토 대상입니다.`
    });
  }

  if (riskiest) {
    insights.push({
      type: riskiest.volatility > ctx.volatility * 1.35 ? "risk" : "neutral",
      title: "변동성 원천",
      text: `${riskiest.asset}의 연율 변동성은 ${formatPct(riskiest.volatility)}입니다. 포트폴리오 변동성 대비 높은 경우 리스크 예산 점검이 필요합니다.`
    });
  }

  insights.push({
    type: concentration > 0.45 ? "risk" : "neutral",
    title: "분산도",
    text: `최대 편입 비중은 ${formatPct(concentration)}${Number.isFinite(avgCorr) ? `, 평균 상관계수는 ${formatNum(avgCorr)}` : ""}입니다. ${concentration > 0.45 ? "단일 자산 집중도가 높아 분산 효과가 제한될 수 있습니다." : "단일 자산 집중도는 관리 가능한 범위입니다."}`
  });

  return insights;
}

function calcConfidence(schema, rows, assets, fallbackRules) {
  let score = 0;
  if (schema.date) score += 18;
  if (schema.asset || assets.length === 1) score += 13;
  if (schema.close || schema.return) score += 22;
  if (schema.weight || schema.value) score += 13;
  if (new Set(rows.map((row) => row.date)).size >= 30) score += 14;
  if (assets.length >= 2) score += 10;
  if (!fallbackRules.some((rule) => rule.type === "warn")) score += 10;
  return Math.min(score, 100);
}

function render(analysis) {
  document.getElementById("dashboardTitle").textContent = `${currentName} 분석`;
  document.getElementById("dashboardSubtitle").textContent = `${analysis.normalized.length.toLocaleString()}개 관측치를 Skills.md 규칙으로 해석했습니다.`;
  document.getElementById("dateRange").textContent = analysis.dates.length ? `${analysis.dates[0]} - ${analysis.dates.at(-1)}` : "";
  renderSkillSteps(analysis.confidence);
  renderSchema(analysis.schema);
  renderFallbacks(analysis.fallbackRules);
  renderKpis(analysis);
  renderCharts(analysis);
  renderInsights(analysis.insights);
  renderQuality(analysis.quality);
  renderTable(analysis.normalized);
}

function renderSkillSteps(confidence) {
  document.getElementById("skillScore").textContent = `${confidence}%`;
  document.getElementById("skillSteps").innerHTML = skillChecklist.map((step, index) => {
    const done = confidence >= (index + 1) * 18;
    return `<li class="${done ? "done" : ""}">${step}</li>`;
  }).join("");
}

function renderSchema(schema) {
  document.getElementById("schemaList").innerHTML = Object.entries(schemaLabels).map(([key, label]) => (
    `<div class="schema-item"><span>${label}</span><strong>${schema[key] || "대체 규칙"}</strong></div>`
  )).join("");
}

function renderFallbacks(rules) {
  document.getElementById("fallbackList").innerHTML = rules.map((rule) => (
    `<div class="fallback-item ${rule.type}"><strong>${rule.label}</strong><span>${rule.text}</span></div>`
  )).join("");
}

function renderKpis(a) {
  const invested = sum(a.latestByAsset.map((row) => Number.isFinite(row.value) ? row.value : 0));
  const kpis = [
    ["누적 수익률", formatPct(a.totalReturn), `연율 수익률 ${formatPct(a.annualReturn)}`],
    ["연율 변동성", formatPct(a.volatility), `${a.returns.length.toLocaleString()}개 수익률 관측치`],
    ["Sharpe", formatNum(a.sharpe), a.sharpe >= 1 ? "위험 대비 성과 양호" : "보수적 해석 필요"],
    ["최대 낙폭", formatPct(a.maxDrawdown), "고점 대비 최저 손실"],
    ["분석 규모", invested ? compactWon(invested) : `${a.assets.length}개 자산`, a.weightSource === "equal_weight" ? "동일 비중 가정" : `${a.assets.length}개 자산 분석`]
  ];
  document.getElementById("kpiGrid").innerHTML = kpis.map(([label, value, hint]) => (
    `<article class="kpi-card"><p>${label}</p><strong>${value}</strong><small>${hint}</small></article>`
  )).join("");
}

function renderCharts(a) {
  const baseline = a.equity.map((_, index) => 100 * Math.pow(1.00018, index));
  createChart("equityChart", "line", {
    labels: a.equity.map((d) => d.date),
    datasets: [
      { label: "Portfolio", data: a.equity.map((d) => d.value), borderColor: palette[0], backgroundColor: "rgba(37,99,235,.12)", tension: 0.25, fill: true, pointRadius: 0 },
      { label: "Baseline", data: baseline, borderColor: "#8b97a8", borderDash: [5, 5], tension: 0.25, pointRadius: 0 }
    ]
  }, lineOptions());

  createChart("drawdownChart", "line", {
    labels: a.drawdowns.map((d) => d.date),
    datasets: [{ label: "Drawdown", data: a.drawdowns.map((d) => d.drawdown * 100), borderColor: palette[2], backgroundColor: "rgba(223,79,103,.14)", fill: true, pointRadius: 0, tension: 0.2 }]
  }, lineOptions("%"));

  createChart("allocationChart", "doughnut", {
    labels: a.assetStats.map((d) => d.asset),
    datasets: [{ data: a.assetStats.map((d) => d.weight * 100), backgroundColor: palette }]
  }, { plugins: { legend: { position: "bottom" } }, maintainAspectRatio: false });

  createChart("scatterChart", "bubble", {
    datasets: a.assetStats.map((asset, index) => ({
      label: asset.asset,
      data: [{ x: asset.volatility * 100, y: asset.return * 100, r: Math.max(6, asset.weight * 44) }],
      backgroundColor: palette[index % palette.length]
    }))
  }, {
    maintainAspectRatio: false,
    scales: {
      x: { title: { display: true, text: "연율 변동성(%)" }, grid: { color: "#edf1f5" } },
      y: { title: { display: true, text: "기간 수익률(%)" }, grid: { color: "#edf1f5" } }
    },
    plugins: { legend: { position: "bottom" } }
  });

  renderCorrelation(a.assets, a.corr);
}

function createChart(id, type, data, options) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id), { type, data, options: { responsive: true, maintainAspectRatio: false, ...options } });
}

function lineOptions(unit = "") {
  return {
    maintainAspectRatio: false,
    scales: {
      x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } },
      y: { grid: { color: "#edf1f5" }, ticks: { callback: (value) => `${value}${unit}` } }
    },
    plugins: { legend: { position: "bottom" } }
  };
}

function renderCorrelation(assets, matrix) {
  const matrixEl = document.getElementById("corrMatrix");
  const note = document.getElementById("correlationNote");
  if (assets.length < 2) {
    note.textContent = "단일 자산";
    matrixEl.style.setProperty("--matrix-size", 1);
    matrixEl.innerHTML = `<div class="empty-state">자산이 1개라 상관 히트맵은 표시하지 않습니다. 개별 성과와 낙폭 중심으로 해석합니다.</div>`;
    return;
  }

  note.textContent = `${assets.length}개 자산`;
  matrixEl.style.setProperty("--matrix-size", assets.length);
  const cells = [`<div></div>`, ...assets.map((a) => `<div class="corr-label">${escapeHtml(short(a))}</div>`)];
  assets.forEach((asset, i) => {
    cells.push(`<div class="corr-label">${escapeHtml(short(asset))}</div>`);
    assets.forEach((_, j) => {
      const value = matrix[i][j];
      const hue = Number.isFinite(value) ? 205 - (value + 1) * 72 : 205;
      const light = Number.isFinite(value) ? 42 + (1 - Math.abs(value)) * 20 : 70;
      cells.push(`<div class="corr-cell" style="background:hsl(${hue},62%,${light}%)">${formatNum(value, 2)}</div>`);
    });
  });
  matrixEl.innerHTML = cells.join("");
}

function renderInsights(insights) {
  document.getElementById("insightList").innerHTML = insights.map((item) => (
    `<div class="insight ${item.type}"><strong>${item.title}</strong><br>${item.text}</div>`
  )).join("");
}

function renderQuality(quality) {
  const warnings = quality.filter((q) => q.level === "warn").length;
  document.getElementById("qualityBadge").textContent = warnings ? `${warnings}개 확인` : "양호";
  document.getElementById("qualityList").innerHTML = quality.map((item) => (
    `<div class="quality-item ${item.level === "warn" ? "warn" : ""}">${item.text}</div>`
  )).join("");
}

function renderTable(rows) {
  const shown = rows.slice(0, 80);
  document.getElementById("rowCount").textContent = `${rows.length.toLocaleString()}행 중 ${shown.length}행 표시`;
  const headers = ["date", "asset", "close", "return", "weight", "value", "volume"];
  document.getElementById("tableHead").innerHTML = `<tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>`;
  document.getElementById("tableBody").innerHTML = shown.map((row) => (
    `<tr>${headers.map((h) => `<td>${formatCell(row[h], h)}</td>`).join("")}</tr>`
  )).join("");
}

function formatCell(value, key) {
  if (key === "return" || key === "weight") return Number.isFinite(value) ? formatPct(value, 2) : "-";
  if (typeof value === "number" && Number.isFinite(value)) return value.toLocaleString("ko-KR", { maximumFractionDigits: 3 });
  return escapeHtml(String(value ?? "-"));
}

function loadDataset(kind) {
  const names = {
    portfolio: "멀티에셋 포트폴리오",
    etf: "ETF 섹터 로테이션",
    single: "단일 종목 리스크 진단",
    korean: "비표준 한글 컬럼 CSV",
    incomplete: "불완전 데이터 처리"
  };
  currentScenario = kind;
  currentName = names[kind] || "업로드 데이터";
  currentRows = createScenarioRows(kind);
  render(analyze(currentRows));
}

function exportSummary() {
  const a = analyze(currentRows);
  const text = [
    `[${currentName}]`,
    `누적 수익률: ${formatPct(a.totalReturn)}`,
    `연율 수익률: ${formatPct(a.annualReturn)}`,
    `연율 변동성: ${formatPct(a.volatility)}`,
    `Sharpe Ratio: ${formatNum(a.sharpe)}`,
    `최대 낙폭: ${formatPct(a.maxDrawdown)}`,
    `대체 계산: ${a.fallbackRules.map((rule) => rule.label).join(", ")}`,
    `핵심 인사이트: ${a.insights[0]?.text || ""}`
  ].join("\n");

  navigator.clipboard?.writeText(text);
  showToast("분석 요약을 클립보드에 복사했습니다.");
}

function downloadSampleCsv() {
  const rows = currentRows;
  const headers = Object.keys(rows[0] || {});
  const csv = [headers.join(","), ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(","))].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${currentScenario}_sample.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value;
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/[./]/g, "-");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function parseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const raw = String(value ?? "").trim();
  if (!raw) return NaN;
  const cleaned = raw.replace(/,/g, "").replace(/[₩원%]/g, "").trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function parsePercentLike(value) {
  const num = parseNumber(value);
  if (!Number.isFinite(num)) return NaN;
  const raw = String(value ?? "");
  if (raw.includes("%")) return num / 100;
  return Math.abs(num) > 1.5 ? num / 100 : num;
}

function numericCoverage(rows, key) {
  if (!rows.length) return 0;
  return rows.filter((row) => Number.isFinite(parseNumber(row[key]))).length / rows.length;
}

function groupBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] ||= [];
    acc[key].push(item);
    return acc;
  }, {});
}

function sum(values) {
  return values.reduce((acc, value) => acc + (Number.isFinite(value) ? value : 0), 0);
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? sum(valid) / valid.length : 0;
}

function std(values) {
  const valid = values.filter(Number.isFinite);
  if (valid.length < 2) return 0;
  const avg = average(valid);
  return Math.sqrt(average(valid.map((value) => Math.pow(value - avg, 2))));
}

function compound(values) {
  return values.reduce((acc, value) => acc * (1 + value), 1);
}

function corr(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return NaN;
  const x = a.slice(0, n).filter(Number.isFinite);
  const y = b.slice(0, n).filter(Number.isFinite);
  const m = Math.min(x.length, y.length);
  if (m < 3) return NaN;
  const mx = average(x.slice(0, m));
  const my = average(y.slice(0, m));
  const numerator = sum(x.slice(0, m).map((v, i) => (v - mx) * (y[i] - my)));
  const denominator = Math.sqrt(sum(x.slice(0, m).map((v) => (v - mx) ** 2)) * sum(y.slice(0, m).map((v) => (v - my) ** 2)));
  return denominator ? numerator / denominator : NaN;
}

function short(text) {
  return text.length > 12 ? `${text.slice(0, 11)}...` : text;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

document.getElementById("datasetSelect").addEventListener("change", (event) => loadDataset(event.target.value));
document.getElementById("resetBtn").addEventListener("click", () => {
  document.getElementById("datasetSelect").value = "portfolio";
  loadDataset("portfolio");
});
document.getElementById("exportBtn").addEventListener("click", exportSummary);
document.getElementById("downloadSampleBtn").addEventListener("click", downloadSampleCsv);
document.getElementById("csvInput").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    currentRows = parseCsv(await file.text());
    currentName = file.name.replace(/\.csv$/i, "");
    currentScenario = "uploaded";
    render(analyze(currentRows));
    showToast(`${file.name} 분석을 완료했습니다.`);
  } catch (error) {
    showToast(error.message);
  }
});

const initialSample = new URLSearchParams(window.location.search).get("sample") || "portfolio";
const allowedSamples = ["portfolio", "etf", "single", "korean", "incomplete"];
document.getElementById("datasetSelect").value = allowedSamples.includes(initialSample) ? initialSample : "portfolio";
loadDataset(document.getElementById("datasetSelect").value);
