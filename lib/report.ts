/**
 * 04 レポートの自動生成（宗教者紹介事業・2026-09-04）
 *
 * 生成器は事業ごとに別。画面（components/ReportView.tsx）は霊園DBからそのままコピーしている。
 * **段階を水増しして霊園の生成器に流し込まないこと。**霊園は5段階のファネルがあるが、
 * 宗教者紹介にはファネルが無い。この事業で読むのは次の3つ（2026-09-04 山崎さん確定）。
 *
 *   1. 手数料率の構成比   … 40%が増えれば、同じお布施額でも手数料が増える
 *   2. 会館別の取りこぼし … 施行件数に対する宗教者紹介の割合
 *   3. 宗教者の偏り       … 特定の宗教者への集中と、単価の差
 *
 * ⚠ 2は**まだ出せない**。施行件数がこのDBのデータ源（Kintone App 1883）に無く、
 *   プロキシが通せる他の4アプリ（313/496/799/195）にも無い。
 *   出せないものを推測で埋めず、「足りないデータ」として何が要るかだけ書く。
 *
 * 守ること（霊園DBと同じ）：
 *   - 予測はしない。画面に出ている数字とその差だけから言う
 *   - 打ち手は必ず数字の裏づけとセットで書く。精神論は書かない
 *   - 母数が小さいものは語らない（率が暴れる。しきい値は MIN_* に集約）
 *
 * 金額の単位は千円。実績は「確定」（葬儀日が今日以前）だけを使う。
 */

export type ReportLevel = 'alert' | 'watch' | 'good' | 'info';

export interface ReportItem {
  key: string;
  level: ReportLevel;
  /** 結論。1行で言い切る */
  title: string;
  /** 事実の説明。1文＝1要素 */
  body: string[];
  /** 打ち手。「だからどうするか」 */
  action?: string;
  list?: { text: string; url?: string }[];
  listNote?: string;
  table?: { headers: string[]; rows: string[][] };
  /** どの数字から言っているか */
  basis: string;
}

export interface ReportSection {
  key: string;
  heading: string;
  lead?: string;
  items: ReportItem[];
}

// ── 母数のしきい値。これ未満は率を語らない ──────────────────────
const MIN_OFFICIANT_COUNT = 10;   // 宗教者ごとの単価を語る最低件数
const MIN_HALL_COUNT = 10;        // 会館ごとの単価を語る最低件数
const MIN_MONTHS_FOR_TREND = 6;   // 前半後半を比べるのに要る月数

// ── 入力 ────────────────────────────────────────────────────────
export interface ReportMonth {
  month: string;
  fee30: number;
  fee40: number;
  feeOther: number;
  total: number;
  planned: number;
  count: number;
  donation: number | null;
  budget: number;
  isKintone: boolean;
}
export interface ReportNamedRow { name: string; fee: number; donation: number; count: number; }
export interface ReportOfficiant {
  name: string;
  total: { fee: number; donation: number; count: number };
}

export interface ReportInput {
  fiscalYearLabel: string;
  /** その期がまだ始まっていないか。true なら結論だけ返して終わる */
  isFuture: boolean;
  monthly: ReportMonth[];
  totalFee: number;
  totalPlanned: number;
  totalCount: number;
  totalDonation: number;
  budgetTotal: number;
  budgetElapsed: number;
  elapsedMonth: string;
  feeByRate: { rate30: number; rate40: number; other: number };
  byHall: ReportNamedRow[];
  byOfficiant: ReportOfficiant[];
  /** Kintoneが担当する月（お布施額が取れる月）。実質手数料率はこの範囲でしか出せない */
  kintoneMonths: string[];
  kintonePeriodLabel: string;
}

// ── 小道具 ──────────────────────────────────────────────────────
const k = (v: number) => Math.round(v).toLocaleString();
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const monthNo = (ym: string) => `${parseInt(ym.slice(5), 10)}月`;
const share = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

/** 期首から当月までの月（＝実績を語ってよい範囲） */
function elapsedMonths(input: ReportInput): ReportMonth[] {
  return input.monthly.filter(m => m.month <= input.elapsedMonth);
}

// ══════════════════════════════════════════════════════════════
// ① 予実（結論）
// ══════════════════════════════════════════════════════════════
function sectionConclusion(input: ReportInput): ReportSection {
  const items: ReportItem[] = [];
  const rate = share(input.totalFee, input.budgetElapsed);
  const gap = input.totalFee - input.budgetElapsed;
  const remainMonths = input.monthly.filter(m => m.month > input.elapsedMonth).length;
  const remainBudget = input.budgetTotal - input.budgetElapsed;

  items.push({
    key: 'pace',
    level: rate >= 1 ? 'good' : rate >= 0.9 ? 'watch' : 'alert',
    title:
      gap >= 0
        ? `経過月の予算に対して ${k(gap)}千円 上回っています（達成率 ${pct(rate)}）`
        : `経過月の予算に対して ${k(-gap)}千円 足りません（達成率 ${pct(rate)}）`,
    body: [
      `${monthNo(input.elapsedMonth)}までの予算 ${k(input.budgetElapsed)}千円 に対して、確定した手数料は ${k(input.totalFee)}千円。`,
      `通期予算は ${k(input.budgetTotal)}千円 で、残り${remainMonths}か月に ${k(remainBudget)}千円 が乗っています。`,
      input.totalPlanned > 0
        ? `これとは別に、葬儀日がこれからの見込みが ${k(input.totalPlanned)}千円 あります（確定には含めていません）。`
        : `葬儀日がこれからの見込みはありません。`,
    ],
    action:
      gap >= 0
        ? undefined
        : `残り${remainMonths}か月で ${k(remainBudget - gap)}千円 を積む必要があります（当初の残予算 ${k(remainBudget)}千円 ＋ 不足 ${k(-gap)}千円）。件数を増やす話と、手数料率を上げる話を分けて詰めてください。`,
    basis: `01サマリーの予算・確定手数料（${monthNo(input.elapsedMonth)}まで）`,
  });

  // 売上＝件数 × 単価。どちらで動いているかを分ける
  const rows = elapsedMonths(input).filter(m => m.count > 0);
  if (rows.length >= MIN_MONTHS_FOR_TREND) {
    const half = Math.floor(rows.length / 2);
    const first = rows.slice(0, half);
    const last = rows.slice(half);
    const unit = (a: ReportMonth[]) =>
      share(a.reduce((s, m) => s + m.total, 0), a.reduce((s, m) => s + m.count, 0));
    const cnt = (a: ReportMonth[]) => a.reduce((s, m) => s + m.count, 0) / a.length;
    const u0 = unit(first), u1 = unit(last);
    const c0 = cnt(first), c1 = cnt(last);
    const uDiff = u1 - u0;
    const cDiff = c1 - c0;
    items.push({
      key: 'count-vs-unit',
      level: 'info',
      title:
        Math.abs(uDiff) * c1 > Math.abs(cDiff) * u1
          ? '動いているのは主に「1件あたりの手数料」です'
          : '動いているのは主に「件数」です',
      body: [
        `前半${first.length}か月：月平均 ${c0.toFixed(1)}件・1件あたり ${k(u0)}千円。`,
        `後半${last.length}か月：月平均 ${c1.toFixed(1)}件・1件あたり ${k(u1)}千円。`,
        `件数は ${cDiff >= 0 ? '+' : ''}${cDiff.toFixed(1)}件/月、単価は ${uDiff >= 0 ? '+' : ''}${k(uDiff)}千円の変化です。`,
      ],
      action:
        Math.abs(uDiff) * c1 > Math.abs(cDiff) * u1
          ? '単価で動いているので、手数料率の構成比（下のセクション）を先に見てください。'
          : '件数で動いているので、会館別の紹介の付き方（下のセクション）を先に見てください。',
      basis: '01サマリーの月別 手数料・件数',
    });
  }

  return { key: 'conclusion', heading: '結論', items };
}

// ══════════════════════════════════════════════════════════════
// ② 手数料率の構成比
// ══════════════════════════════════════════════════════════════
function sectionRate(input: ReportInput): ReportSection {
  const items: ReportItem[] = [];
  const { rate30, rate40, other } = input.feeByRate;
  const total = rate30 + rate40 + other;

  if (total <= 0) {
    return {
      key: 'rate',
      heading: '手数料率の構成比',
      items: [{
        key: 'rate-nodata',
        level: 'info',
        title: '手数料率の内訳がまだ出ていません',
        body: ['確定した手数料が0のため、構成比を出せません。'],
        basis: '01サマリーの手数料率別',
      }],
    };
  }

  const s40 = share(rate40, total);
  const s30 = share(rate30, total);
  items.push({
    key: 'rate-mix',
    level: 'info',
    title: `手数料の ${pct(s40)} が40%契約、${pct(s30)} が30%契約です`,
    body: [
      `40%：${k(rate40)}千円／30%：${k(rate30)}千円${other > 0 ? `／その他：${k(other)}千円` : ''}。`,
      `40%の比率が1ポイント上がると、同じお布施額でも手数料は約 ${k(total * 0.01 * 0.25)}千円 増える計算になります（30%→40%で手数料は約1.33倍）。`,
    ],
    basis: '01サマリーの手数料率別',
  });

  // 実質手数料率（お布施額が取れるKintone期間のみ）
  const kMonths = elapsedMonths(input).filter(m => m.isKintone && m.donation !== null);
  const don = kMonths.reduce((s, m) => s + (m.donation ?? 0), 0);
  const fee = kMonths.reduce((s, m) => s + m.total, 0);
  if (don > 0) {
    const eff = share(fee, don);
    items.push({
      key: 'rate-effective',
      level: eff >= 0.38 ? 'good' : eff >= 0.33 ? 'watch' : 'alert',
      title: `実質の手数料率は ${pct(eff)} です（${input.kintonePeriodLabel}）`,
      body: [
        `お布施額 ${k(don)}千円 に対して手数料 ${k(fee)}千円。`,
        `40%契約だけなら40%、30%契約だけなら30%になります。いまは ${pct(eff)} なので、その間のどこにいるかが分かります。`,
      ],
      action:
        eff < 0.38
          ? `40%へ寄せられる余地があります。30%契約の会館・宗教者を洗い出し、条件の見直しができるものから当たってください。1ポイントで約 ${k(don * 0.01)}千円 です。`
          : undefined,
      basis: `01サマリーの月別 手数料・お布施額（お布施額はKintone期間のみ）`,
    });
  }

  // 前半後半で40%比率が動いているか
  const rows = elapsedMonths(input).filter(m => m.fee30 + m.fee40 + m.feeOther > 0);
  if (rows.length >= MIN_MONTHS_FOR_TREND) {
    const half = Math.floor(rows.length / 2);
    const sh = (a: ReportMonth[]) =>
      share(a.reduce((s, m) => s + m.fee40, 0), a.reduce((s, m) => s + m.fee30 + m.fee40 + m.feeOther, 0));
    const b = sh(rows.slice(0, half));
    const a = sh(rows.slice(half));
    const d = a - b;
    if (Math.abs(d) >= 0.02) {
      items.push({
        key: 'rate-trend',
        level: d > 0 ? 'good' : 'watch',
        title: `40%の比率が ${d > 0 ? '上がって' : '下がって'}います（${pct(b)} → ${pct(a)}）`,
        body: [
          `前半${half}か月の40%比率 ${pct(b)}、後半${rows.length - half}か月 ${pct(a)}。`,
          d > 0
            ? '同じ件数でも手数料が増える方向です。'
            : '同じ件数でも手数料が減る方向です。件数が横ばいなら、これが売上の下押し要因になります。',
        ],
        action: d < 0 ? '直近で増えた30%契約がどの会館・宗教者のものか、下の一覧で当たってください。' : undefined,
        basis: '01サマリーの月別 30%手数料・40%手数料',
      });
    }
  }

  return {
    key: 'rate',
    heading: '手数料率の構成比',
    lead: '40%が増えれば、同じお布施額でも手数料が増えます。',
    items,
  };
}

// ══════════════════════════════════════════════════════════════
// ③ 会館別（取りこぼしは出せない）
// ══════════════════════════════════════════════════════════════
function sectionHall(input: ReportInput): ReportSection {
  const items: ReportItem[] = [];

  // 取りこぼし率は施行件数が要る。無いものは無いと書く
  items.push({
    key: 'hall-missing-data',
    level: 'info',
    title: '会館別の取りこぼし率は、いまのデータでは出せません',
    body: [
      '取りこぼし率＝宗教者紹介の件数 ÷ その会館の葬儀施行件数。分母の施行件数がこのDBにありません。',
      'Kintone App 1883（宗教者紹介）には紹介した案件しか入っておらず、紹介が付かなかった葬儀は最初から存在しません。',
      'プロキシが通せる他のアプリ（313 霊園／496 旧不動産／799 ティアファミリー／195 不動産）にも施行件数はありません。',
    ],
    action: '会館別・月別の葬儀施行件数がどこにあるかを教えてください。Kintoneのアプリであれば、APIトークンの発行とプロキシへの追加で繋がります。繋がれば、この画面に「施行はあるのに紹介が付いていない会館」が出せます。',
    basis: 'Kintone App 1883 のフィールド一覧／context/proxy_architecture.md の許可アプリ',
  });

  // 分母が無くても言えること：会館ごとの1件あたり手数料の差
  const halls = input.byHall.filter(h => h.count >= MIN_HALL_COUNT && h.name !== '未入力');
  if (halls.length >= 3) {
    const withUnit = halls
      .map(h => ({ ...h, unit: share(h.fee, h.count) }))
      .sort((a, b) => b.unit - a.unit);
    const top = withUnit[0];
    const bottom = withUnit[withUnit.length - 1];
    const allUnit = share(
      input.byHall.reduce((s, h) => s + h.fee, 0),
      input.byHall.reduce((s, h) => s + h.count, 0),
    );
    const lowVolume = withUnit
      .filter(h => h.unit < allUnit * 0.85)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    items.push({
      key: 'hall-unit',
      level: bottom.unit < allUnit * 0.8 ? 'watch' : 'info',
      title: `1件あたりの手数料は会館で ${k(bottom.unit)}〜${k(top.unit)}千円 の開きがあります`,
      body: [
        `全体の平均は ${k(allUnit)}千円／件。${MIN_HALL_COUNT}件以上ある ${halls.length}会館で比べています。`,
        `いちばん高いのは ${top.name}（${k(top.unit)}千円・${top.count}件）、低いのは ${bottom.name}（${k(bottom.unit)}千円・${bottom.count}件）。`,
      ],
      table:
        lowVolume.length > 0
          ? {
              headers: ['会館', '件数', '手数料（千円）', '1件あたり'],
              rows: lowVolume.map(h => [h.name, `${h.count}`, k(h.fee), `${k(h.unit)}千円`]),
            }
          : undefined,
      action:
        lowVolume.length > 0
          ? '件数はあるのに1件あたりが平均を15%以上下回る会館です。手数料率が30%に寄っているか、お布施額そのものが低いかのどちらかなので、まずどちらかを確かめてください。'
          : undefined,
      basis: '事業部・会館タブの会館別（手数料・件数）',
    });
  }

  return {
    key: 'hall',
    heading: '会館別',
    lead: '取りこぼし率＝施行件数に対する宗教者紹介の割合。分母がまだありません。',
    items,
  };
}

// ══════════════════════════════════════════════════════════════
// ④ 宗教者の偏り
// ══════════════════════════════════════════════════════════════
function sectionOfficiant(input: ReportInput): ReportSection {
  const items: ReportItem[] = [];
  const all = input.byOfficiant.filter(o => o.name && o.name !== '未入力' && o.total.count > 0);

  if (all.length === 0) {
    return {
      key: 'officiant',
      heading: '宗教者の偏り',
      items: [{
        key: 'officiant-nodata',
        level: 'info',
        title: '宗教者別のデータがまだありません',
        body: ['お布施額・手数料が宗教者に紐づくのはKintone期間のみです。'],
        basis: '宗派・宗教者タブ',
      }],
    };
  }

  const sorted = [...all].sort((a, b) => b.total.fee - a.total.fee);
  const totalFee = sorted.reduce((s, o) => s + o.total.fee, 0);
  const totalCount = sorted.reduce((s, o) => s + o.total.count, 0);
  const top5 = sorted.slice(0, 5);
  const top5Share = share(top5.reduce((s, o) => s + o.total.fee, 0), totalFee);

  items.push({
    key: 'officiant-concentration',
    level: top5Share >= 0.6 ? 'watch' : 'info',
    title: `上位5名で手数料の ${pct(top5Share)} を占めています（全${all.length}名）`,
    body: [
      `${top5.map(o => `${o.name} ${k(o.total.fee)}千円（${o.total.count}件）`).join('／')}。`,
      top5Share >= 0.6
        ? '特定の宗教者に依存しています。1名でも動けなくなると、その分がそのまま抜けます。'
        : '極端な依存はありません。',
    ],
    action:
      top5Share >= 0.6
        ? '上位5名の稼働可能な件数に上限がないかを確認してください。上限が近いなら、件数を増やす打ち手は「新しい宗教者を増やす」側にしかありません。'
        : undefined,
    basis: '宗派・宗教者タブの宗教者別（手数料・件数）',
  });

  // 単価の差。母数の小さい人は語らない
  const enough = sorted
    .filter(o => o.total.count >= MIN_OFFICIANT_COUNT)
    .map(o => ({ ...o, unit: share(o.total.fee, o.total.count) }))
    .sort((a, b) => b.unit - a.unit);

  if (enough.length >= 3) {
    const avgUnit = share(totalFee, totalCount);
    const hi = enough[0];
    const lo = enough[enough.length - 1];
    // 単価が低いのに件数が多い＝全体の単価を押し下げている
    const draggers = enough
      .filter(o => o.unit < avgUnit * 0.85)
      .sort((a, b) => b.total.count - a.total.count)
      .slice(0, 5);
    const dragCount = draggers.reduce((s, o) => s + o.total.count, 0);

    items.push({
      key: 'officiant-unit',
      level: draggers.length > 0 ? 'watch' : 'good',
      title: `1件あたりの手数料は ${k(lo.unit)}〜${k(hi.unit)}千円。平均は ${k(avgUnit)}千円です`,
      body: [
        `${MIN_OFFICIANT_COUNT}件以上ある ${enough.length}名で比べています。`,
        draggers.length > 0
          ? `平均を15%以上下回る宗教者に ${dragCount}件（全体の${pct(share(dragCount, totalCount))}）が寄っています。`
          : '平均を大きく下回る宗教者に件数が寄ってはいません。',
      ],
      table:
        draggers.length > 0
          ? {
              headers: ['宗教者', '件数', '手数料（千円）', '1件あたり'],
              rows: draggers.map(o => [o.name, `${o.total.count}`, k(o.total.fee), `${k(o.unit)}千円`]),
            }
          : undefined,
      action:
        draggers.length > 0
          ? `この${draggers.length}名の1件あたりが平均まで上がると、${k(draggers.reduce((s, o) => s + (avgUnit - o.unit) * o.total.count, 0))}千円 の差になります。手数料率の契約条件か、担当している葬儀の規模か、どちらの理由かを確かめてください。`
          : undefined,
      basis: '宗派・宗教者タブの宗教者別（手数料・件数）',
    });
  }

  return {
    key: 'officiant',
    heading: '宗教者の偏り',
    lead: '特定の宗教者への集中と、1件あたりの手数料の差を見ます。',
    items,
  };
}

// ══════════════════════════════════════════════════════════════
// ⑤ 足りないデータ
// ══════════════════════════════════════════════════════════════
function sectionGaps(input: ReportInput): ReportSection {
  const items: ReportItem[] = [];

  const unknownHall = input.byHall.find(h => h.name === '未入力');
  if (unknownHall && unknownHall.count > 0) {
    const totalCount = input.byHall.reduce((s, h) => s + h.count, 0);
    const r = share(unknownHall.count, totalCount);
    items.push({
      key: 'gap-hall',
      level: r >= 0.05 ? 'alert' : 'watch',
      title: `会館名が未入力の案件が ${unknownHall.count}件（全体の${pct(r)}）あります`,
      body: [
        `手数料にして ${k(unknownHall.fee)}千円 が、どの会館のものか分かりません。`,
        '会館別の比較はこの分だけ実態より小さく出ます。',
      ],
      action: 'Kintone側で会館名を必須にするか、未入力の案件を洗い出して埋めてください。',
      basis: '事業部・会館タブの会館別（未入力行）',
    });
  }

  const noDonation = elapsedMonths(input).filter(m => !m.isKintone).length;
  if (noDonation > 0) {
    items.push({
      key: 'gap-donation',
      level: 'info',
      title: `お布施額が取れない月が ${noDonation}か月 あります`,
      body: [
        `${input.kintonePeriodLabel} 以外はExcel集計が出どころで、手数料しかありません。`,
        '実質手数料率（手数料÷お布施額）は、この期間では出せません。',
      ],
      basis: '01サマリーの月別（Kintoneバッジのない月）',
    });
  }

  if (items.length === 0) {
    items.push({
      key: 'gap-none',
      level: 'good',
      title: '分析を止めている入力の抜けはありません',
      body: ['会館名・お布施額とも、この期のぶんは揃っています。'],
      basis: '事業部・会館タブ／01サマリーの月別',
    });
  }

  return { key: 'gaps', heading: '足りないデータ', items };
}

// ══════════════════════════════════════════════════════════════
export function buildReport(input: ReportInput): ReportSection[] {
  if (input.isFuture) {
    return [{
      key: 'future',
      heading: '結論',
      items: [{
        key: 'future',
        level: 'info',
        title: `${input.fiscalYearLabel}はまだ始まっていません`,
        body: ['実績が1件も無いため、読めることがありません。期が始まってからご覧ください。'],
        basis: '—',
      }],
    }];
  }

  return [
    sectionConclusion(input),
    sectionRate(input),
    sectionHall(input),
    sectionOfficiant(input),
    sectionGaps(input),
  ];
}
