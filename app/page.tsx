'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SCENARIOS,
  addUnexpectedEvent,
  applyRecommendation,
  buildRecommendations,
  calculateProjection,
  cloneScenario,
  formatDate,
  formatMoney,
  type CashEvent,
  type ProjectionReport,
  type Recommendation,
  type ScenarioId,
  type ScenarioState,
} from './simulator';

type ImpactRecord = {
  action: string;
  amount: number;
  beforeMinimum: number;
  afterMinimum: number;
  avoidedGap: number;
  resolved: boolean;
  avoidedCost: number | null;
  leadDays: number;
};

const guidedSteps = [
  ['Conheça a cliente', 'Comece pelo contexto: contas recorrentes, pouca folga e dinheiro distribuído.'],
  ['Veja o risco antes do vencimento', 'A curva mostra quando o saldo cruza o mínimo de segurança.'],
  ['Entenda o diagnóstico', 'O copiloto separa falta real de dinheiro de liquidez no lugar errado.'],
  ['Compare as alternativas', 'As opções aparecem na ordem do menor custo total para a cliente.'],
  ['Inclua um imprevisto', 'A próxima etapa adiciona uma despesa inesperada e recalcula o plano.'],
  ['Escolha a melhor ação', 'A alternativa mais segura será selecionada para simulação.'],
  ['Autorize com controle', 'A ação só será executada depois de uma confirmação explícita.'],
  ['Verifique o novo fluxo', 'Depois da execução, o motor recalcula todos os saldos.'],
  ['Mostre o impacto', 'Encerre com o déficit evitado, antecedência e crédito não contratado.'],
] as const;

const certaintyLabels: Record<CashEvent['certainty'], string> = {
  confirmed: 'Confirmado',
  probable: 'Provável',
  estimated: 'Estimado',
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function BalanceChart({ state, report }: { state: ScenarioState; report: ProjectionReport }) {
  const width = 860;
  const height = 286;
  const margins = { top: 24, right: 24, bottom: 44, left: 70 };
  const plotWidth = width - margins.left - margins.right;
  const plotHeight = height - margins.top - margins.bottom;
  const values = report.points.flatMap((point) => [point.p10, point.p90, state.minimumBalance]);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = Math.max(180, (rawMax - rawMin) * 0.16);
  const yMin = rawMin - padding;
  const yMax = rawMax + padding;
  const x = (index: number) => margins.left + (index / Math.max(1, report.points.length - 1)) * plotWidth;
  const y = (value: number) => margins.top + ((yMax - value) / Math.max(1, yMax - yMin)) * plotHeight;
  const line = report.points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point.p50)}`).join(' ');
  const topBand = report.points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point.p90)}`).join(' ');
  const bottomBand = [...report.points]
    .reverse()
    .map((point, reverseIndex) => {
      const index = report.points.length - reverseIndex - 1;
      return `L ${x(index)} ${y(point.p10)}`;
    })
    .join(' ');
  const band = `${topBand} ${bottomBand} Z`;
  const tickIndexes = Array.from(new Set([0, Math.floor((report.points.length - 1) / 2), report.points.length - 1]));
  const yTicks = [yMin, (yMin + yMax) / 2, yMax];

  return (
    <div className="chart-wrap">
      <svg className="balance-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="chart-title chart-description">
        <title id="chart-title">Projeção diária do saldo Itaú</title>
        <desc id="chart-description">Curva mediana com faixa de incerteza, saldo mínimo e primeiro dia provável de déficit.</desc>
        <defs>
          <linearGradient id="uncertainty-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-blue)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--brand-blue)" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <rect x={margins.left} y={margins.top} width={plotWidth} height={plotHeight} className="chart-frame" />
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={margins.left} x2={width - margins.right} y1={y(tick)} y2={y(tick)} className="grid-line" />
            <text x={margins.left - 12} y={y(tick) + 4} textAnchor="end" className="axis-label">{formatMoney(tick)}</text>
          </g>
        ))}
        <path d={band} fill="url(#uncertainty-fill)" />
        <line x1={margins.left} x2={width - margins.right} y1={y(state.minimumBalance)} y2={y(state.minimumBalance)} className="minimum-line" />
        <text x={width - margins.right - 4} y={y(state.minimumBalance) - 8} textAnchor="end" className="minimum-label">mínimo {formatMoney(state.minimumBalance)}</text>
        <path d={line} className="median-line" />
        {report.riskDate && report.firstRiskIndex >= 0 ? (
          <g>
            <line x1={x(report.firstRiskIndex)} x2={x(report.firstRiskIndex)} y1={margins.top} y2={margins.top + plotHeight} className="risk-guide" />
            <circle cx={x(report.firstRiskIndex)} cy={y(report.points[report.firstRiskIndex].p50)} r="7" className="risk-dot" />
            <text x={clamp(x(report.firstRiskIndex) + 10, margins.left + 10, width - margins.right - 12)} y={margins.top + 18} textAnchor={x(report.firstRiskIndex) > width * 0.75 ? 'end' : 'start'} className="risk-label">risco em {formatDate(report.riskDate)}</text>
          </g>
        ) : null}
        {tickIndexes.map((index) => (
          <text key={index} x={x(index)} y={height - 17} textAnchor={index === 0 ? 'start' : index === report.points.length - 1 ? 'end' : 'middle'} className="axis-label">{formatDate(report.points[index].date)}</text>
        ))}
        {state.events.filter((cashEvent) => report.points.some((point) => point.date === cashEvent.date)).map((cashEvent) => {
          const index = report.points.findIndex((point) => point.date === cashEvent.date);
          return (
            <circle key={cashEvent.id} cx={x(index)} cy={margins.top + 8} r="4" className={cashEvent.amount >= 0 ? 'event-dot income' : 'event-dot expense'}>
              <title>{`${cashEvent.label}: ${formatMoney(cashEvent.amount)} em ${formatDate(cashEvent.date)}`}</title>
            </circle>
          );
        })}
        <text x={16} y={margins.top + plotHeight / 2} transform={`rotate(-90 16 ${margins.top + plotHeight / 2})`} textAnchor="middle" className="axis-title">Saldo projetado (R$)</text>
      </svg>
      <div className="chart-legend" aria-label="Legenda do gráfico">
        <span><i className="legend-line" /> saldo mediano</span>
        <span><i className="legend-band" /> conservador–otimista</span>
        <span><i className="legend-risk" /> risco</span>
      </div>
    </div>
  );
}

function EventTable({ events }: { events: CashEvent[] }) {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="events-list">
      {sorted.map((cashEvent) => (
        <div className="event-row" key={cashEvent.id}>
          <div className={`event-symbol ${cashEvent.amount >= 0 ? 'positive' : 'negative'}`} aria-hidden="true">{cashEvent.amount >= 0 ? '+' : '−'}</div>
          <div className="event-main"><strong>{cashEvent.label}</strong><span>{formatDate(cashEvent.date, true)} · {cashEvent.source}</span></div>
          <div className="event-meta">
            <strong className={cashEvent.amount >= 0 ? 'money-positive' : ''}>{formatMoney(cashEvent.amount)}</strong>
            <span className={`certainty ${cashEvent.certainty}`}>{certaintyLabels[cashEvent.certainty]} · {Math.round(cashEvent.probability * 100)}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecommendationCard({ recommendation, selected, onSelect }: { recommendation: Recommendation; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" className={`recommendation ${selected ? 'selected' : ''} ${recommendation.available ? '' : 'disabled'}`} onClick={onSelect} disabled={!recommendation.available} aria-pressed={selected}>
      <span className="rec-rank">{recommendation.kind === 'credit' ? 'última opção' : recommendation.cost === 0 ? 'sem custo' : 'alternativa'}</span>
      <strong>{recommendation.label}</strong>
      <span>{recommendation.summary}</span>
      <span className="rec-footer">
        <span>{recommendation.cost === null ? 'Custo não estimado' : recommendation.cost === 0 ? 'R$ 0 de custo' : `${formatMoney(recommendation.cost, 2)} simulados`}</span>
        <span>{recommendation.turnaround}</span>
      </span>
      {!recommendation.available ? <em>{recommendation.unavailableReason}</em> : null}
    </button>
  );
}

function AgentActivity({ report, selected, impact }: { report: ProjectionReport; selected: Recommendation | null; impact: ImpactRecord | null }) {
  const rows = [
    ['Contas analisadas', 'done'],
    ['Projeção construída', 'done'],
    [report.riskDate ? 'Risco detectado' : 'Fluxo saudável', 'done'],
    ['Causa identificada', report.riskDate ? 'done' : 'idle'],
    ['Alternativas consultadas', report.riskDate ? 'done' : 'idle'],
    ['Simulação preparada', selected ? 'done' : 'active'],
    ['Autorização do cliente', impact ? 'done' : selected ? 'active' : 'idle'],
    ['Resultado verificado', impact ? 'done' : 'idle'],
  ];
  return <ol className="agent-steps" aria-label="Atividade do copiloto">{rows.map(([label, status]) => <li key={label} className={status}><span aria-hidden="true">{status === 'done' ? '✓' : status === 'active' ? '•' : ''}</span>{label}</li>)}</ol>;
}

export default function Home() {
  const [state, setState] = useState<ScenarioState>(() => cloneScenario('local'));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [impact, setImpact] = useState<ImpactRecord | null>(null);
  const [auditLog, setAuditLog] = useState<string[]>(['Dados simulados carregados', 'Projeção inicial concluída']);
  const [guidedStep, setGuidedStep] = useState<number | null>(null);
  const [channelOpen, setChannelOpen] = useState(false);
  const [channelStep, setChannelStep] = useState(0);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const executionLock = useRef(false);

  const report = useMemo(() => calculateProjection(state), [state]);
  const recommendations = useMemo(() => buildRecommendations(state, report), [state, report]);
  const selected = recommendations.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setConfirmationOpen(false);
      setChannelOpen(false);
      setPortfolioOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  function changeScenario(id: ScenarioId) {
    setState(cloneScenario(id));
    setSelectedId(null);
    setConfirmationOpen(false);
    setImpact(null);
    setAuditLog(['Cenário reiniciado', 'Projeção recalculada']);
    setGuidedStep(null);
  }

  function updateState(patch: Partial<ScenarioState>) {
    setState((current) => ({ ...current, ...patch }));
    setSelectedId(null);
    setImpact(null);
  }

  function updateEvent(id: string, patch: Partial<CashEvent>) {
    setState((current) => ({ ...current, events: current.events.map((cashEvent) => (cashEvent.id === id ? { ...cashEvent, ...patch } : cashEvent)) }));
    setSelectedId(null);
    setImpact(null);
  }

  function simulateUnexpected() {
    if (state.surpriseApplied) {
      setToast('O imprevisto já está incluído neste cenário.');
      return;
    }
    setState((current) => addUnexpectedEvent(current));
    setSelectedId(null);
    setImpact(null);
    setAuditLog((current) => [...current, 'Imprevisto de R$ 460 incluído', 'Plano recalculado']);
    setToast('Imprevisto incluído. O plano foi recalculado.');
  }

  function executeSelected() {
    if (!selected || !selected.available || executionLock.current) return;
    executionLock.current = true;
    const before = report;
    const nextState = applyRecommendation(state, selected);
    const after = calculateProjection(nextState);
    setState(nextState);
    setImpact({
      action: selected.label,
      amount: selected.amount,
      beforeMinimum: before.minimumMedian,
      afterMinimum: after.minimumMedian,
      avoidedGap: before.projectedGap,
      resolved: !after.riskDate,
      avoidedCost: selected.cost === 0 ? Math.round(Math.max(18, before.projectedGap * 0.08)) : null,
      leadDays: before.daysToRisk ?? state.alertLeadDays,
    });
    setAuditLog((current) => [...current, `Cliente autorizou: ${selected.label}`, 'Ação executada uma única vez', !after.riskDate ? 'Déficit evitado e fluxo verificado' : 'Risco reduzido; acompanhamento mantido']);
    setSelectedId(null);
    setConfirmationOpen(false);
    setToast(!after.riskDate ? 'Déficit evitado. Novo fluxo verificado.' : 'Ação concluída. Ainda existe risco residual.');
    if (guidedStep === 6) setGuidedStep(7);
    window.setTimeout(() => { executionLock.current = false; }, 500);
  }

  function advanceGuide() {
    if (guidedStep === null) {
      changeScenario('local');
      setGuidedStep(0);
      return;
    }
    if (guidedStep === 4 && !state.surpriseApplied) simulateUnexpected();
    if (guidedStep === 5 && !selectedId) {
      const firstAvailable = recommendations.find((item) => item.available);
      if (firstAvailable) setSelectedId(firstAvailable.id);
    }
    if (guidedStep === 6) {
      const currentSelected = recommendations.find((item) => item.id === selectedId) ?? recommendations.find((item) => item.available);
      if (currentSelected) {
        setSelectedId(currentSelected.id);
        setConfirmationOpen(true);
        return;
      }
    }
    if (guidedStep >= guidedSteps.length - 1) {
      setGuidedStep(null);
      return;
    }
    setGuidedStep((current) => (current ?? 0) + 1);
  }

  async function requestFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      setToast('O navegador bloqueou a tela cheia. A demonstração continua disponível.');
    }
  }

  const primaryEvent = state.events.find((cashEvent) => cashEvent.id === 'invoice');
  const salaryEvent = state.events.find((cashEvent) => cashEvent.id === 'salary');
  const pixEvent = state.events.find((cashEvent) => cashEvent.id === 'client-pix');
  const riskPercent = Math.round(report.riskProbability * 100);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><div className="brand-mark" aria-hidden="true">i</div><div><strong>ia.i · fluxo futuro</strong><span>Copiloto preventivo de liquidez</span></div></div>
        <div className="header-meta"><span className="demo-label">Demonstração conceitual · dados simulados</span><button type="button" className="secondary-button" onClick={() => { setChannelStep(0); setChannelOpen(true); }}>Jornada multicanal</button><button type="button" className="secondary-button" onClick={requestFullscreen}>Apresentar</button></div>
      </header>

      <section className="scenario-strip" aria-label="Cenários da demonstração">
        <div className="scenario-buttons">{(Object.keys(SCENARIOS) as ScenarioId[]).map((id, index) => <button key={id} type="button" className={state.id === id ? 'scenario-button active' : 'scenario-button'} aria-pressed={state.id === id} onClick={() => changeScenario(id)}><span>0{index + 1}</span>{SCENARIOS[id].shortTitle}</button>)}</div>
        <div className="scenario-actions"><button type="button" className="secondary-button" onClick={simulateUnexpected}>Simular imprevisto</button><button type="button" className="primary-button" onClick={() => setGuidedStep(0)}>Iniciar demonstração guiada</button></div>
      </section>

      {guidedStep !== null ? (
        <section className="guide-bar" aria-live="polite">
          <div className="guide-progress"><span style={{ width: `${((guidedStep + 1) / guidedSteps.length) * 100}%` }} /></div>
          <div className="guide-copy"><span>Etapa {guidedStep + 1} de {guidedSteps.length}</span><strong>{guidedSteps[guidedStep][0]}</strong><p>{guidedSteps[guidedStep][1]}</p></div>
          <div className="guide-actions"><button type="button" className="text-button" onClick={() => setGuidedStep(null)}>Sair</button><button type="button" className="secondary-button" disabled={guidedStep === 0} onClick={() => setGuidedStep((current) => Math.max(0, (current ?? 0) - 1))}>Voltar</button><button type="button" className="primary-button" onClick={advanceGuide}>{guidedStep === guidedSteps.length - 1 ? 'Concluir' : 'Próximo'}</button></div>
        </section>
      ) : null}

      <section className="hero-row">
        <div><span className="eyebrow">{state.persona}</span><h1>{state.title}</h1><p>{state.narrative}</p></div>
        <div className="connection-status"><span className={state.openFinance ? 'status-dot online' : 'status-dot'} aria-hidden="true" /><div><strong>{state.openFinance ? '2 instituições conectadas' : 'Visão parcial'}</strong><span>{state.openFinance ? 'Atualizado há 2 min' : 'Open Finance desativado'}</span></div></div>
      </section>

      <section className="metrics-grid" aria-live="polite">
        <article className="metric-card"><span>Saldo Itaú hoje</span><strong>{formatMoney(state.itauBalance)}</strong><em>{state.openFinance ? `${formatMoney(state.externalBalance)} em outra instituição` : 'Outras contas não conectadas'}</em></article>
        <article className="metric-card"><span>Menor saldo projetado</span><strong className={report.minimumMedian < state.minimumBalance ? 'negative-value' : ''}>{formatMoney(report.minimumMedian)}</strong><em>{report.riskDate ? `em ${formatDate(report.riskDate, true)}` : 'acima do mínimo configurado'}</em></article>
        <article className="metric-card emphasis"><span>Risco previsto</span><strong>{report.riskDate ? `${riskPercent}%` : 'baixo'}</strong><em>{report.riskDate ? `${formatMoney(report.projectedGap)} abaixo do mínimo` : 'nenhuma ação necessária'}</em></article>
      </section>

      <section className="main-grid">
        <article className="surface forecast-surface">
          <div className="section-heading"><div><span className="eyebrow">Previsão para {state.horizon} dias</span><h2>Quando o saldo pode ficar insuficiente</h2></div><label className="compact-field">Horizonte<select value={state.horizon} onChange={(event) => updateState({ horizon: Number(event.target.value) as 7 | 14 | 30 })}><option value="7">7 dias</option><option value="14">14 dias</option><option value="30">30 dias</option></select></label></div>
          <BalanceChart state={state} report={report} />
          <div className="account-strip"><div><span>Conta Itaú</span><strong>{formatMoney(state.itauBalance)}</strong></div><div className={!state.openFinance ? 'muted-account' : ''}><span>Outra instituição</span><strong>{state.openFinance ? formatMoney(state.externalBalance) : 'não conectada'}</strong></div><div><span>Cofrinho</span><strong>{formatMoney(state.cofrinhoBalance)}</strong></div><div><span>Saldo mínimo</span><strong>{formatMoney(state.minimumBalance)}</strong></div></div>
        </article>

        <aside className="agent-panel" aria-live="polite">
          <div className="agent-head"><div className="agent-avatar" aria-hidden="true">ia</div><div><strong>Copiloto ia.i</strong><span>previsão atualizada agora</span></div><span className={`confidence ${report.confidence}`}>{report.confidenceScore}% confiança</span></div>
          <div className={`diagnosis ${report.diagnosis}`}><span>{report.riskDate ? 'Atenção antecipada' : 'Tudo certo'}</span><h2>{report.diagnosisLabel}</h2><p>{report.diagnosisText}</p>{report.riskDate ? <div className="diagnosis-number"><strong>{formatMoney(report.projectedGap)}</strong><span>de ajuste até {formatDate(report.riskDate)}</span></div> : null}</div>
          {pixEvent && pixEvent.certainty !== 'confirmed' ? <div className="uncertainty-prompt"><span>Entrada ainda incerta</span><strong>Você espera receber {formatMoney(pixEvent.amount)} em {formatDate(pixEvent.date)}?</strong><p>A confirmação muda a confiança da projeção, mas pode ser revista depois.</p><div><button type="button" className="secondary-button" onClick={() => updateEvent(pixEvent.id, { probability: 0 })}>Não contar com o Pix</button><button type="button" className="primary-button" onClick={() => updateEvent(pixEvent.id, { certainty: 'confirmed', probability: 1, variance: 0 })}>Confirmar recebimento</button></div></div> : null}
          {recommendations.length ? <div className="recommendation-list"><div className="recommendation-heading"><strong>Melhores caminhos</strong><span>ordenados pelo menor custo</span></div>{recommendations.slice(0, 4).map((recommendation) => <RecommendationCard key={recommendation.id} recommendation={recommendation} selected={selectedId === recommendation.id} onSelect={() => setSelectedId(recommendation.id)} />)}</div> : <div className="healthy-message">Nenhuma intervenção é necessária neste horizonte.</div>}
          {selected ? <div className="selected-simulation"><span>Simulação antes de executar</span><p>{selected.reason}</p><div className="before-after-inline"><div><span>antes</span><strong>{formatMoney(report.minimumMedian)}</strong></div><span aria-hidden="true">→</span><div><span>depois</span><strong>{formatMoney(selected.impactAfter)}</strong></div></div><button type="button" className="primary-button full-width" onClick={() => setConfirmationOpen(true)}>Revisar e autorizar</button></div> : null}
        </aside>
      </section>

      {impact ? <section className={impact.resolved ? 'impact-banner resolved' : 'impact-banner'} aria-live="polite"><div className="impact-icon" aria-hidden="true">✓</div><div className="impact-copy"><span>{impact.resolved ? 'Déficit evitado' : 'Risco reduzido'}</span><h2>{impact.action} concluído</h2><p>O menor saldo projetado passou de {formatMoney(impact.beforeMinimum)} para {formatMoney(impact.afterMinimum)}.</p></div><div className="impact-stats"><div><strong>{formatMoney(impact.avoidedGap)}</strong><span>déficit tratado</span></div><div><strong>{impact.leadDays} dias</strong><span>de antecedência</span></div><div><strong>{impact.avoidedCost ? formatMoney(impact.avoidedCost) : 'não estimado'}</strong><span>custo potencial evitado</span></div><div><strong>sem crédito</strong><span>liquidez própria primeiro</span></div></div></section> : null}

      <section className="detail-grid">
        <article className="surface">
          <div className="section-heading"><div><span className="eyebrow">Fontes e confiança</span><h2>Próximos movimentos</h2></div><span className="small-note">Créditos entram antes dos débitos quando não há horário informado.</span></div>
          <EventTable events={state.events} />
        </article>
        <article className="surface controls-surface">
          <div className="section-heading"><div><span className="eyebrow">Sandbox</span><h2>Altere o cenário</h2></div><button type="button" className="text-button" onClick={() => changeScenario(state.id)}>Reiniciar</button></div>
          <div className="controls-grid">
            <label>Saldo Itaú <span>{formatMoney(state.itauBalance)}</span><input type="range" min="0" max="5000" step="10" value={state.itauBalance} onChange={(event) => updateState({ itauBalance: Number(event.target.value) })} /></label>
            <label>Outro banco <span>{formatMoney(state.externalBalance)}</span><input type="range" min="0" max="5000" step="10" value={state.externalBalance} disabled={!state.openFinance} onChange={(event) => updateState({ externalBalance: Number(event.target.value) })} /></label>
            <label>Cofrinho <span>{formatMoney(state.cofrinhoBalance)}</span><input type="range" min="0" max="5000" step="10" value={state.cofrinhoBalance} onChange={(event) => updateState({ cofrinhoBalance: Number(event.target.value) })} /></label>
            <label>Valor da fatura <span>{primaryEvent ? formatMoney(Math.abs(primaryEvent.amount)) : '—'}</span><input type="range" min="200" max="3500" step="50" value={Math.abs(primaryEvent?.amount ?? 0)} disabled={!primaryEvent} onChange={(event) => primaryEvent && updateEvent(primaryEvent.id, { amount: -Number(event.target.value) })} /></label>
          </div>
          <div className="switch-row"><label><input type="checkbox" checked={state.openFinance} onChange={(event) => updateState({ openFinance: event.target.checked })} /><span>Open Finance conectado</span></label><label><input type="checkbox" checked={state.allowCofrinho} onChange={(event) => updateState({ allowCofrinho: event.target.checked })} /><span>Autorizar uso do Cofrinho</span></label><label><input type="checkbox" checked={state.protectReserve} onChange={(event) => updateState({ protectReserve: event.target.checked })} /><span>Proteger reserva</span></label><label><input type="checkbox" checked={state.avoidCredit} onChange={(event) => updateState({ avoidCredit: event.target.checked })} /><span>Evitar crédito</span></label></div>
          <details className="advanced-controls"><summary>Parâmetros avançados</summary><div className="advanced-grid">
            <label>Saldo mínimo<input type="number" min="0" step="50" value={state.minimumBalance} onChange={(event) => updateState({ minimumBalance: Math.max(0, Number(event.target.value)) })} /></label>
            <label>Antecedência do alerta<input type="number" min="1" max="15" value={state.alertLeadDays} onChange={(event) => updateState({ alertLeadDays: clamp(Number(event.target.value), 1, 15) })} /></label>
            {salaryEvent ? <label>Data do salário<input type="date" value={salaryEvent.date} onChange={(event) => updateEvent(salaryEvent.id, { date: event.target.value })} /></label> : null}
            {salaryEvent ? <label>Valor do salário<input type="number" min="0" step="50" value={salaryEvent.amount} onChange={(event) => updateEvent(salaryEvent.id, { amount: Number(event.target.value) })} /></label> : null}
            {pixEvent ? <label>Data do Pix esperado<input type="date" value={pixEvent.date} onChange={(event) => updateEvent(pixEvent.id, { date: event.target.value })} /></label> : null}
            {pixEvent ? <label>Probabilidade do Pix ({Math.round(pixEvent.probability * 100)}%)<input type="range" min="0" max="100" step="1" value={pixEvent.probability * 100} onChange={(event) => updateEvent(pixEvent.id, { probability: Number(event.target.value) / 100 })} /></label> : null}
          </div>
            <div className="event-editor">
              <h3>Ajustar boletos, débitos e parcelas</h3>
              {state.events.filter((cashEvent) => cashEvent.amount < 0).map((cashEvent) => <div key={`edit-${cashEvent.id}`}><span>{cashEvent.label}</span><label>Valor<input aria-label={`Valor de ${cashEvent.label}`} type="number" min="0" step="10" value={Math.abs(cashEvent.amount)} onChange={(event) => updateEvent(cashEvent.id, { amount: -Math.abs(Number(event.target.value)) })} /></label><label>Data<input aria-label={`Data de ${cashEvent.label}`} type="date" value={cashEvent.date} onChange={(event) => updateEvent(cashEvent.id, { date: event.target.value })} /></label></div>)}
            </div>
          </details>
        </article>
      </section>

      <section className="lower-grid">
        <article className="surface agent-log-surface"><div className="section-heading"><div><span className="eyebrow">Orquestração auditável</span><h2>Atividade do agente</h2></div></div><AgentActivity report={report} selected={selected} impact={impact} /></article>
        <article className="surface audit-surface"><div className="section-heading"><div><span className="eyebrow">Controle e consentimento</span><h2>Registro da jornada</h2></div><button type="button" className="text-button" onClick={() => setPortfolioOpen(true)}>Visão da carteira</button></div><ul className="audit-log">{auditLog.slice(-5).map((item, index) => <li key={`${item}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span>{item}</li>)}</ul><p className="guardrail-note">O motor financeiro calcula. A IA explica e orquestra. O motor de políticas limita as ofertas. A cliente autoriza.</p></article>
      </section>

      <footer><span>Conceito para hackathon · não representa produto ou oferta comercial disponível</span><span>Referência simulada: 25/08/2026</span></footer>

      {confirmationOpen && selected ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setConfirmationOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><span className="eyebrow">Confirmação no app</span><h2 id="confirm-title">Revise antes de autorizar</h2><p>{selected.reason}</p><div className="confirmation-summary"><div><span>Ação</span><strong>{selected.label}</strong></div><div><span>Valor</span><strong>{formatMoney(selected.amount)}</strong></div><div><span>Custo</span><strong>{selected.cost === null ? 'não estimado' : formatMoney(selected.cost, 2)}</strong></div><div><span>Risco</span><strong>{selected.risk}</strong></div><div><span>Resultado projetado</span><strong>{formatMoney(selected.impactAfter)}</strong></div><div><span>Integração</span><strong>{selected.integration}</strong></div></div><div className="modal-notice">Nenhuma movimentação ocorre sem esta confirmação. A execução será registrada uma única vez.</div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setConfirmationOpen(false)}>Cancelar</button><button type="button" className="primary-button" onClick={executeSelected}>Confirmar ação</button></div></section></div> : null}

      {channelOpen ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setChannelOpen(false)}><section className="modal channel-modal" role="dialog" aria-modal="true" aria-labelledby="channel-title"><div className="section-heading"><div><span className="eyebrow">WhatsApp → app → WhatsApp</span><h2 id="channel-title">Jornada multicanal</h2></div><button type="button" className="text-button" onClick={() => setChannelOpen(false)}>Fechar</button></div><div className="channel-steps">{['Alerta', 'Autorização', 'Confirmação'].map((label, index) => <button type="button" key={label} className={channelStep === index ? 'active' : ''} onClick={() => setChannelStep(index)}>{index + 1}. {label}</button>)}</div><div className="phone-frame"><div className="phone-top"><strong>{channelStep === 1 ? 'Itaú' : 'Assistente financeiro'}</strong><span>agora</span></div>{channelStep === 0 ? <div className="message-thread"><div className="message incoming"><strong>Encontrei um risco no seu fluxo</strong><p>Em {report.daysToRisk ?? 3} dias, podem faltar {formatMoney(report.projectedGap)} para seus compromissos.</p></div><div className="message outgoing">Quais são as opções sem crédito?</div><div className="message incoming"><p>Há dinheiro disponível em outra conta. Posso preparar uma transferência para você revisar no app.</p></div></div> : null}{channelStep === 1 ? <div className="app-confirm-card"><span>Revisão segura</span><h3>Trazer dinheiro</h3><strong>{formatMoney(recommendations.find((item) => item.kind === 'transfer')?.amount ?? report.projectedGap)}</strong><p>Origem: conta conectada<br />Destino: Conta Itaú<br />Custo: R$ 0</p><button type="button" className="primary-button full-width" onClick={() => setChannelStep(2)}>Autorizar no app</button></div> : null}{channelStep === 2 ? <div className="message-thread"><div className="message incoming success"><strong>Pronto, problema resolvido</strong><p>A transferência foi concluída e o fluxo foi recalculado. A fatura permanece coberta.</p></div><div className="channel-impact">✓ ação registrada<br /><strong>nenhum novo crédito</strong></div></div> : null}</div><div className="modal-actions"><button type="button" className="secondary-button" disabled={channelStep === 0} onClick={() => setChannelStep((current) => Math.max(0, current - 1))}>Voltar</button><button type="button" className="primary-button" disabled={channelStep === 2} onClick={() => setChannelStep((current) => Math.min(2, current + 1))}>Próximo canal</button></div></section></div> : null}

      {portfolioOpen ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPortfolioOpen(false)}><section className="modal portfolio-modal" role="dialog" aria-modal="true" aria-labelledby="portfolio-title"><div className="section-heading"><div><span className="eyebrow">Visão simulada</span><h2 id="portfolio-title">Impacto potencial na carteira</h2></div><button type="button" className="text-button" onClick={() => setPortfolioOpen(false)}>Fechar</button></div><p>Projeção ilustrativa para demonstrar quais resultados um piloto deveria medir — não são resultados reais.</p><div className="portfolio-grid"><div><strong>12,4 mil</strong><span>clientes monitorados</span></div><div><strong>2,8 mil</strong><span>alertas úteis</span></div><div><strong>71%</strong><span>resolvidos antes do vencimento</span></div><div><strong>64%</strong><span>sem novo crédito</span></div><div><strong>R$ 1,9 mi</strong><span>liquidez própria movimentada</span></div><div><strong>4,6 dias</strong><span>antecedência média</span></div></div></section></div> : null}

      {toast ? <div className="toast" role="status" aria-live="polite">{toast}</div> : null}
    </main>
  );
}
