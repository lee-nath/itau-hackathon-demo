export type ScenarioId = 'local' | 'timing' | 'consolidated' | 'variable';
export type Certainty = 'confirmed' | 'probable' | 'estimated';
export type AccountId = 'itau' | 'external';
export type DiagnosisKind = 'healthy' | 'local' | 'temporal' | 'consolidated' | 'structural';

export interface CashEvent {
  id: string;
  label: string;
  date: string;
  amount: number;
  account: AccountId;
  certainty: Certainty;
  probability: number;
  source: string;
  category: 'income' | 'bill' | 'card' | 'installment' | 'unexpected';
  variance?: number;
}

export interface ScenarioOffers {
  dueDateChange?: { eventId: string; newDate: string; cost: number };
  negotiation?: { eventId: string; newDate: string; newAmount: number; cost: number };
  credit?: { amountLimit: number; cost: number; label: string };
}

export interface ScenarioState {
  id: ScenarioId;
  title: string;
  shortTitle: string;
  persona: string;
  narrative: string;
  referenceDate: string;
  horizon: 7 | 14 | 30;
  itauBalance: number;
  externalBalance: number;
  cofrinhoBalance: number;
  minimumBalance: number;
  openFinance: boolean;
  allowCofrinho: boolean;
  protectReserve: boolean;
  avoidCredit: boolean;
  alertLeadDays: number;
  events: CashEvent[];
  offers: ScenarioOffers;
  surpriseApplied: boolean;
}

export interface ProjectionPoint {
  date: string;
  p10: number;
  p50: number;
  p90: number;
  externalP50: number;
  totalP50: number;
  riskProbability: number;
}

export interface ProjectionReport {
  points: ProjectionPoint[];
  riskDate: string | null;
  riskProbability: number;
  projectedGap: number;
  minimumMedian: number;
  consolidatedAtRisk: number;
  diagnosis: DiagnosisKind;
  diagnosisLabel: string;
  diagnosisText: string;
  confidence: 'alta' | 'média' | 'baixa';
  confidenceScore: number;
  firstRiskIndex: number;
  daysToRisk: number | null;
}

export interface Recommendation {
  id: string;
  kind: 'transfer' | 'cofrinho' | 'due-date' | 'negotiate' | 'credit';
  label: string;
  summary: string;
  amount: number;
  cost: number | null;
  turnaround: string;
  risk: 'baixo' | 'médio' | 'alto';
  reason: string;
  impactAfter: number;
  available: boolean;
  unavailableReason?: string;
  integration: string;
}

const baseDate = '2026-08-25';

const event = (
  id: string,
  label: string,
  offset: number,
  amount: number,
  account: AccountId,
  certainty: Certainty,
  probability: number,
  source: string,
  category: CashEvent['category'],
  variance = certainty === 'confirmed' ? 0 : 0.1,
): CashEvent => ({
  id,
  label,
  date: addDays(baseDate, offset),
  amount,
  account,
  certainty,
  probability,
  source,
  category,
  variance,
});

export const SCENARIOS: Record<ScenarioId, ScenarioState> = {
  local: {
    id: 'local',
    title: 'Dinheiro no lugar errado',
    shortTitle: 'Saldo em outro banco',
    persona: 'Marina, 34 anos · assalariada',
    narrative: 'A fatura será debitada no Itaú, mas a liquidez necessária está em outra instituição.',
    referenceDate: baseDate,
    horizon: 14,
    itauBalance: 780,
    externalBalance: 1_180,
    cofrinhoBalance: 480,
    minimumBalance: 200,
    openFinance: true,
    allowCofrinho: true,
    protectReserve: true,
    avoidCredit: true,
    alertLeadDays: 4,
    events: [
      event('energy', 'Conta de energia', 2, -220, 'itau', 'confirmed', 1, 'DDA Itaú', 'bill'),
      event('invoice', 'Fatura do cartão', 3, -1_150, 'itau', 'confirmed', 1, 'Cartão Itaú', 'card'),
      event('streaming', 'Assinaturas', 7, -86, 'itau', 'confirmed', 1, 'Débito automático', 'bill'),
      event('salary', 'Salário', 12, 2_600, 'itau', 'confirmed', 1, 'Histórico Itaú', 'income'),
    ],
    offers: {
      dueDateChange: { eventId: 'invoice', newDate: addDays(baseDate, 13), cost: 0 },
      credit: { amountLimit: 1_200, cost: 54.8, label: 'Crédito pessoal pré-aprovado' },
    },
    surpriseApplied: false,
  },
  timing: {
    id: 'timing',
    title: 'Descasamento de datas',
    shortTitle: 'Fatura antes do salário',
    persona: 'Rafael, 29 anos · analista',
    narrative: 'A fatura vence cinco dias antes do salário, criando uma falta temporária de caixa.',
    referenceDate: baseDate,
    horizon: 14,
    itauBalance: 520,
    externalBalance: 240,
    cofrinhoBalance: 1_100,
    minimumBalance: 250,
    openFinance: true,
    allowCofrinho: true,
    protectReserve: false,
    avoidCredit: true,
    alertLeadDays: 5,
    events: [
      event('invoice', 'Fatura do cartão', 3, -1_260, 'itau', 'confirmed', 1, 'Cartão Itaú', 'card'),
      event('rent', 'Aluguel', 5, -680, 'itau', 'confirmed', 1, 'Pix agendado', 'bill'),
      event('salary', 'Salário', 8, 3_800, 'itau', 'confirmed', 1, 'Histórico Itaú', 'income'),
      event('installment', 'Parcela notebook', 11, -210, 'itau', 'confirmed', 1, 'Fatura futura', 'installment'),
    ],
    offers: {
      dueDateChange: { eventId: 'invoice', newDate: addDays(baseDate, 10), cost: 0 },
      credit: { amountLimit: 1_800, cost: 71.2, label: 'Parcelamento de fatura' },
    },
    surpriseApplied: false,
  },
  consolidated: {
    id: 'consolidated',
    title: 'Falta consolidada',
    shortTitle: 'Recursos insuficientes',
    persona: 'Carlos, 41 anos · técnico',
    narrative: 'Mesmo somando contas e reserva disponível, os compromissos superam a liquidez do período.',
    referenceDate: baseDate,
    horizon: 14,
    itauBalance: 360,
    externalBalance: 140,
    cofrinhoBalance: 120,
    minimumBalance: 200,
    openFinance: true,
    allowCofrinho: true,
    protectReserve: false,
    avoidCredit: true,
    alertLeadDays: 5,
    events: [
      event('rent', 'Aluguel', 2, -920, 'itau', 'confirmed', 1, 'Pix agendado', 'bill'),
      event('invoice', 'Fatura do cartão', 4, -780, 'itau', 'confirmed', 1, 'Cartão Itaú', 'card'),
      event('salary', 'Adiantamento salarial', 9, 540, 'itau', 'confirmed', 1, 'Folha Itaú', 'income'),
      event('utility', 'Contas da casa', 11, -310, 'itau', 'probable', 0.92, 'Histórico recorrente', 'bill', 0.08),
    ],
    offers: {
      negotiation: { eventId: 'invoice', newDate: addDays(baseDate, 18), newAmount: 780, cost: 0 },
      credit: { amountLimit: 1_500, cost: 96.4, label: 'Parcelamento em 3 vezes' },
    },
    surpriseApplied: false,
  },
  variable: {
    id: 'variable',
    title: 'Renda variável',
    shortTitle: 'Pix ainda incerto',
    persona: 'Luana, 32 anos · autônoma',
    narrative: 'Recebimentos de clientes podem cobrir as contas, mas datas e valores ainda não estão confirmados.',
    referenceDate: baseDate,
    horizon: 14,
    itauBalance: 610,
    externalBalance: 260,
    cofrinhoBalance: 340,
    minimumBalance: 200,
    openFinance: true,
    allowCofrinho: true,
    protectReserve: true,
    avoidCredit: true,
    alertLeadDays: 4,
    events: [
      event('client-pix', 'Pix de cliente', 3, 1_480, 'itau', 'estimated', 0.58, 'Padrão dos últimos 4 meses', 'income', 0.2),
      event('invoice', 'Fatura do cartão', 4, -1_190, 'itau', 'confirmed', 1, 'Cartão Itaú', 'card'),
      event('studio', 'Aluguel do estúdio', 6, -520, 'itau', 'confirmed', 1, 'Pix agendado', 'bill'),
      event('client-pix-2', 'Segundo recebível', 10, 720, 'external', 'probable', 0.68, 'Conta conectada', 'income', 0.16),
      event('supplies', 'Materiais', 12, -280, 'itau', 'estimated', 0.75, 'Média mensal', 'bill', 0.18),
    ],
    offers: {
      dueDateChange: { eventId: 'invoice', newDate: addDays(baseDate, 9), cost: 0 },
      negotiation: { eventId: 'studio', newDate: addDays(baseDate, 12), newAmount: 520, cost: 0 },
      credit: { amountLimit: 1_000, cost: 84.3, label: 'Antecipação simulada' },
    },
    surpriseApplied: false,
  },
};

export function cloneScenario(id: ScenarioId): ScenarioState {
  return JSON.parse(JSON.stringify(SCENARIOS[id])) as ScenarioState;
}

export function addDays(iso: string, amount: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const one = new Date(`${a}T12:00:00Z`).getTime();
  const two = new Date(`${b}T12:00:00Z`).getTime();
  return Math.round((two - one) / 86_400_000);
}

export function formatMoney(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits,
  }).format(value);
}

export function formatDate(iso: string, withYear = false): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    ...(withYear ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  }).format(new Date(`${iso}T12:00:00Z`));
}

function hashState(state: ScenarioState): number {
  const serial = JSON.stringify({
    id: state.id,
    horizon: state.horizon,
    itauBalance: state.itauBalance,
    externalBalance: state.externalBalance,
    minimumBalance: state.minimumBalance,
    openFinance: state.openFinance,
    events: state.events.map(({ id, date, amount, probability }) => ({ id, date, amount, probability })),
  });
  let hash = 2166136261;
  for (let index = 0; index < serial.length; index += 1) {
    hash ^= serial.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let value = seed || 1;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index] ?? 0;
}

export function calculateProjection(state: ScenarioState): ProjectionReport {
  const days = Array.from({ length: state.horizon + 1 }, (_, index) => addDays(state.referenceDate, index));
  const runs = 360;
  const itauByDay = days.map(() => [] as number[]);
  const externalByDay = days.map(() => [] as number[]);

  for (let run = 0; run < runs; run += 1) {
    const random = seededRandom(hashState(state) + run * 9973);
    let itau = state.itauBalance;
    let external = state.openFinance ? state.externalBalance : 0;

    days.forEach((day, dayIndex) => {
      state.events
        .filter((cashEvent) => cashEvent.date === day)
        .forEach((cashEvent) => {
          const occurs = cashEvent.certainty === 'confirmed' || random() <= cashEvent.probability;
          if (!occurs) return;
          const variance = cashEvent.variance ?? 0;
          const multiplier = cashEvent.certainty === 'confirmed' ? 1 : 1 + (random() * 2 - 1) * variance;
          const value = cashEvent.amount * multiplier;
          if (cashEvent.account === 'itau') itau += value;
          if (cashEvent.account === 'external' && state.openFinance) external += value;
        });
      itauByDay[dayIndex].push(itau);
      externalByDay[dayIndex].push(external);
    });
  }

  const points = days.map((date, index) => {
    const p10 = percentile(itauByDay[index], 0.1);
    const p50 = percentile(itauByDay[index], 0.5);
    const p90 = percentile(itauByDay[index], 0.9);
    const externalP50 = percentile(externalByDay[index], 0.5);
    const riskProbability = itauByDay[index].filter((value) => value < state.minimumBalance).length / runs;
    return {
      date,
      p10,
      p50,
      p90,
      externalP50,
      totalP50: p50 + externalP50,
      riskProbability,
    };
  });

  const firstRiskIndex = points.findIndex((point) => point.riskProbability >= 0.2);
  const riskPoint = firstRiskIndex >= 0 ? points[firstRiskIndex] : null;
  const minimumMedian = Math.min(...points.map((point) => point.p50));
  const projectedGap = riskPoint ? Math.max(0, state.minimumBalance - minimumMedian) : 0;
  const riskProbability = riskPoint ? Math.max(...points.slice(firstRiskIndex).map((point) => point.riskProbability)) : 0;
  const consolidatedAtRisk = riskPoint ? riskPoint.totalP50 + state.cofrinhoBalance : state.itauBalance + (state.openFinance ? state.externalBalance : 0) + state.cofrinhoBalance;

  const riskEpisodes = points.reduce(
    (acc, point, index) => acc + (point.p50 < state.minimumBalance && (index === 0 || points[index - 1].p50 >= state.minimumBalance) ? 1 : 0),
    0,
  );
  const confirmedInflowSoon = riskPoint
    ? state.events
        .filter(
          (cashEvent) =>
            cashEvent.amount > 0 &&
            cashEvent.certainty === 'confirmed' &&
            cashEvent.date > riskPoint.date &&
            daysBetween(riskPoint.date, cashEvent.date) <= 7,
        )
        .reduce((total, cashEvent) => total + cashEvent.amount, 0)
    : 0;
  const externalAvailable = state.openFinance ? Math.max(0, state.externalBalance - 100) : 0;

  let diagnosis: DiagnosisKind = 'healthy';
  if (riskPoint) {
    if (riskEpisodes >= 2 && consolidatedAtRisk < state.minimumBalance) diagnosis = 'structural';
    else if (confirmedInflowSoon >= projectedGap) diagnosis = 'temporal';
    else if (externalAvailable + (state.allowCofrinho && !state.protectReserve ? state.cofrinhoBalance : 0) >= projectedGap) diagnosis = 'local';
    else diagnosis = 'consolidated';
  }

  const labels: Record<DiagnosisKind, [string, string]> = {
    healthy: ['Fluxo saudável', 'Os compromissos conhecidos permanecem acima do saldo mínimo configurado.'],
    local: ['Déficit local', 'Há liquidez suficiente, mas ela está em outra conta ou reserva acessível.'],
    temporal: ['Déficit temporal', 'Uma entrada confiável chega poucos dias depois do vencimento principal.'],
    consolidated: ['Falta consolidada', 'Somar contas e reserva disponível ainda não cobre o compromisso no prazo.'],
    structural: ['Déficit estrutural', 'A insuficiência reaparece em mais de um ciclo e exige reorganização mais ampla.'],
  };

  const uncertainShare = state.events.filter((cashEvent) => cashEvent.certainty !== 'confirmed').length / Math.max(1, state.events.length);
  const confidenceScore = Math.round(Math.max(42, 96 - uncertainShare * 48 - (state.openFinance ? 0 : 18)));
  const confidence = confidenceScore >= 82 ? 'alta' : confidenceScore >= 70 ? 'média' : 'baixa';

  return {
    points,
    riskDate: riskPoint?.date ?? null,
    riskProbability,
    projectedGap,
    minimumMedian,
    consolidatedAtRisk,
    diagnosis,
    diagnosisLabel: labels[diagnosis][0],
    diagnosisText: labels[diagnosis][1],
    confidence,
    confidenceScore,
    firstRiskIndex,
    daysToRisk: riskPoint ? daysBetween(state.referenceDate, riskPoint.date) : null,
  };
}

function roundedActionAmount(gap: number): number {
  return Math.max(50, Math.ceil(gap / 10) * 10);
}

export function buildRecommendations(state: ScenarioState, report: ProjectionReport): Recommendation[] {
  if (!report.riskDate) return [];
  const needed = roundedActionAmount(report.projectedGap);
  const recommendations: Recommendation[] = [];
  const externalAvailable = state.openFinance ? Math.max(0, state.externalBalance - 100) : 0;

  if (state.openFinance && state.externalBalance > 0) {
    const amount = Math.min(needed, externalAvailable);
    recommendations.push({
      id: 'transfer',
      kind: 'transfer',
      label: 'Trazer dinheiro de outra conta',
      summary: amount >= needed ? 'Resolve o déficit sem novo crédito' : 'Reduz o déficit com liquidez própria',
      amount,
      cost: 0,
      turnaround: 'imediato',
      risk: 'baixo',
      reason: amount >= needed
        ? 'Existe liquidez própria disponível e a transferência não tem custo.'
        : 'Usa primeiro o saldo próprio disponível antes de outras alternativas.',
      impactAfter: report.minimumMedian + amount,
      available: amount > 0,
      unavailableReason: amount <= 0 ? 'O saldo de origem precisa preservar R$ 100.' : undefined,
      integration: 'Pix via Open Finance',
    });
  }

  if (state.cofrinhoBalance > 0) {
    const blocked = !state.allowCofrinho || state.protectReserve;
    const amount = Math.min(needed, state.cofrinhoBalance);
    recommendations.push({
      id: 'cofrinho',
      kind: 'cofrinho',
      label: 'Usar parte do Cofrinho',
      summary: blocked ? 'Reserva protegida pela sua preferência' : 'Liquidez imediata dentro do Itaú',
      amount,
      cost: 0,
      turnaround: 'imediato',
      risk: 'baixo',
      reason: blocked
        ? 'A memória financeira está configurada para não movimentar esta reserva.'
        : 'O resgate cobre parte ou todo o déficit sem juros.',
      impactAfter: report.minimumMedian + amount,
      available: !blocked && amount > 0,
      unavailableReason: blocked ? 'Proteção da reserva ativada' : undefined,
      integration: 'Cofrinho Itaú',
    });
  }

  if (state.offers.dueDateChange) {
    const offer = state.offers.dueDateChange;
    const affected = state.events.find((cashEvent) => cashEvent.id === offer.eventId);
    const impact = report.minimumMedian + Math.abs(affected?.amount ?? needed);
    recommendations.push({
      id: 'due-date',
      kind: 'due-date',
      label: 'Mudar o vencimento',
      summary: `Levar o compromisso para ${formatDate(offer.newDate)}`,
      amount: Math.abs(affected?.amount ?? needed),
      cost: offer.cost,
      turnaround: 'após confirmação',
      risk: 'baixo',
      reason: 'Oferta simulada já autorizada pelo motor de políticas do produto.',
      impactAfter: impact,
      available: true,
      integration: 'Produto Itaú',
    });
  }

  if (state.offers.negotiation) {
    const offer = state.offers.negotiation;
    recommendations.push({
      id: 'negotiate',
      kind: 'negotiate',
      label: 'Negociar o compromisso',
      summary: `Nova data simulada: ${formatDate(offer.newDate)}`,
      amount: offer.newAmount,
      cost: offer.cost,
      turnaround: 'após aceite',
      risk: 'médio',
      reason: 'O fluxo consolidado não é suficiente; reorganizar o prazo evita uma solução inadequada.',
      impactAfter: report.minimumMedian + offer.newAmount,
      available: true,
      integration: 'Oferta pré-aprovada',
    });
  }

  if (state.offers.credit) {
    const blocked = state.avoidCredit;
    recommendations.push({
      id: 'credit',
      kind: 'credit',
      label: state.offers.credit.label,
      summary: blocked ? 'Bloqueado pela preferência “evitar crédito”' : 'Alternativa com custo — último recurso',
      amount: Math.min(needed, state.offers.credit.amountLimit),
      cost: state.offers.credit.cost,
      turnaround: 'após contratação',
      risk: 'alto',
      reason: blocked
        ? 'A memória financeira impede que crédito seja recomendado automaticamente.'
        : 'Só aparece depois das opções de liquidez própria e negociação.',
      impactAfter: report.minimumMedian + Math.min(needed, state.offers.credit.amountLimit),
      available: !blocked,
      unavailableReason: blocked ? 'Preferência ativa' : undefined,
      integration: 'Oferta simulada do motor de crédito',
    });
  }

  return recommendations.sort((a, b) => {
    const priority: Record<Recommendation['kind'], number> = {
      transfer: 1,
      cofrinho: 2,
      'due-date': 3,
      negotiate: 4,
      credit: 5,
    };
    if (a.available !== b.available) return a.available ? -1 : 1;
    const aResolves = a.impactAfter >= state.minimumBalance;
    const bResolves = b.impactAfter >= state.minimumBalance;
    if (aResolves !== bResolves) return aResolves ? -1 : 1;
    return priority[a.kind] - priority[b.kind];
  });
}

export function applyRecommendation(state: ScenarioState, recommendation: Recommendation): ScenarioState {
  if (!recommendation.available) return state;
  const next: ScenarioState = JSON.parse(JSON.stringify(state));
  const amount = recommendation.amount;

  if (recommendation.kind === 'transfer') {
    next.externalBalance -= amount;
    next.itauBalance += amount;
  }
  if (recommendation.kind === 'cofrinho') {
    next.cofrinhoBalance -= amount;
    next.itauBalance += amount;
  }
  if (recommendation.kind === 'due-date' && next.offers.dueDateChange) {
    const cashEvent = next.events.find((item) => item.id === next.offers.dueDateChange?.eventId);
    if (cashEvent) cashEvent.date = next.offers.dueDateChange.newDate;
  }
  if (recommendation.kind === 'negotiate' && next.offers.negotiation) {
    const cashEvent = next.events.find((item) => item.id === next.offers.negotiation?.eventId);
    if (cashEvent) {
      cashEvent.date = next.offers.negotiation.newDate;
      cashEvent.amount = -Math.abs(next.offers.negotiation.newAmount);
    }
  }
  if (recommendation.kind === 'credit') {
    next.itauBalance += amount;
  }
  return next;
}

export function addUnexpectedEvent(state: ScenarioState): ScenarioState {
  if (state.surpriseApplied) return state;
  const next: ScenarioState = JSON.parse(JSON.stringify(state));
  next.events.push(
    event(
      'unexpected',
      'Imprevisto: reparo doméstico',
      2,
      -460,
      'itau',
      'confirmed',
      1,
      'Evento inserido na demonstração',
      'unexpected',
    ),
  );
  next.surpriseApplied = true;
  return next;
}
