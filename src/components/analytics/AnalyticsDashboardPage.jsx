import React, { useState } from 'react'
import { DASHBOARD_PERIODS, useDashboardLeads } from '../../hooks/useDashboardLeads.js'
import { useIsMobile } from '../../hooks/useIsMobile.js'

const STATUT_COLORS = {
  'nouveau': '#4f7ff3',
  'Prospect contacté': '#f59e0b',
  'À relancer': '#f97316',
  'Opportunité': '#22c55e',
  'Relancé': '#a78bfa',
  'Converti': '#16a34a',
  'Perdu': '#6b7280',
}

const PRIORITE_COLORS = {
  'Haute': '#bf1818',
  'Normale': '#f59e0b',
  'Basse': '#6b7280',
}

function fmtEur(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)
}

function fmtPct(n, decimals = 1) {
  return Number(n || 0).toFixed(decimals).replace('.', ',') + ' %'
}

function fmtDate(isoStr) {
  if (!isoStr) return '—'
  try {
    return new Date(isoStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}

function fmtDelta(deltaObj, isCurrency = false) {
  if (!deltaObj || deltaObj.pct == null) return null
  const sign = deltaObj.delta >= 0 ? '+' : ''
  return isCurrency
    ? `${sign}${fmtEur(deltaObj.delta)} vs période précédente`
    : `${sign}${fmtPct(deltaObj.pct)} vs période précédente`
}

function SectionCard({ children, style }) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01))',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: '16px 18px',
      boxShadow: 'var(--shadow-soft)',
      position: 'relative',
      overflow: 'hidden',
      ...style,
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.025), transparent 32%)',
      }} />
      <div style={{ position: 'relative' }}>
      {children}
      </div>
    </div>
  )
}

function SectionHeading({ children, action }) {
  return (
    <div style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--muted)',
        marginBottom: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      gap: 10,
    }}>
      <span>{children}</span>
      {action}
    </div>
  )
}

function FilterChip({ active, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11,
        padding: '6px 11px',
        borderRadius: 999,
        border: active ? '1px solid var(--select-accent)' : '1px solid var(--border-md)',
        background: active ? 'linear-gradient(180deg, rgba(79,127,243,0.18), rgba(79,127,243,0.08))' : 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        color: active ? 'var(--select-accent)' : 'var(--muted)',
        cursor: 'pointer',
        fontWeight: active ? 600 : 500,
      }}
    >
      {label}
    </button>
  )
}

function ActionLink({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11,
        color: 'var(--text)',
        cursor: 'pointer',
        padding: '7px 12px',
        borderRadius: 999,
        border: '1px solid var(--select-border)',
        background: 'linear-gradient(180deg, rgba(79,127,243,0.18), rgba(79,127,243,0.08))',
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  )
}

function KpiCard({ label, value, accent, sub, delta, onClick }) {
  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      onClick={onClick}
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '15px 16px',
        minWidth: 0,
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: onClick ? 'var(--shadow-soft)' : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute',
        inset: '0 auto auto 0',
        height: 3,
        width: '100%',
        background: `linear-gradient(90deg, ${accent}, transparent 70%)`,
        opacity: 0.9,
      }} />
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--muted)',
        marginBottom: 7,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 26,
        fontWeight: 700,
        color: accent,
        fontFamily: 'var(--serif)',
        lineHeight: 1,
        marginBottom: sub || delta ? 7 : 0,
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: delta ? 4 : 0, lineHeight: 1.45 }}>{sub}</div>}
      {delta && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{delta}</div>}
    </Component>
  )
}

function ActionCard({ item, onClick, stretch = false }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '16px 16px',
        borderRadius: 14,
        border: '1px solid var(--border)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))',
        textAlign: 'left',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-soft)',
        minWidth: 190,
        flex: stretch ? '1 1 100%' : '1 1 190px',
        maxWidth: stretch ? 'none' : 260,
      }}
    >
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: item.tone, marginBottom: 8 }}>
        {item.label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--serif)', lineHeight: 1 }}>
        {item.count}
      </div>
    </button>
  )
}

function QualityRow({ item, maxCount, onClick }) {
  const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        textAlign: 'left',
        padding: '10px 12px',
        cursor: 'pointer',
      }}
    >
      <div style={{ width: 150, fontSize: 12, color: 'var(--muted)' }}>{item.label}</div>
      <div style={{ flex: 1, height: 9, background: 'rgba(255,255,255,0.045)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(pct, item.count > 0 ? 3 : 0)}%`, height: '100%', background: item.tone, borderRadius: 999 }} />
      </div>
      <div style={{ width: 36, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{item.count}</div>
    </button>
  )
}

function StatutPill({ statut }) {
  const color = STATUT_COLORS[statut] || 'var(--muted)'
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      borderRadius: 20,
      border: `1px solid ${color}44`,
      background: `${color}18`,
      fontSize: 11,
      fontWeight: 500,
      color,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {statut}
    </span>
  )
}

function PrioriteBadge({ priorite }) {
  const color = PRIORITE_COLORS[priorite] || 'var(--muted2)'
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 600,
      padding: '2px 7px',
      borderRadius: 4,
      border: `1px solid ${color}44`,
      background: `${color}18`,
      color,
    }}>
      {priorite || '—'}
    </span>
  )
}

export default function AnalyticsDashboardPage({ onOpenLeads }) {
  const mobile = useIsMobile()
  const [periodKey, setPeriodKey] = useState('30d')
  const { loading, error, stats } = useDashboardLeads(periodKey)

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--muted)' }}>
        <div style={{ width: 20, height: 20, border: '2px solid var(--border-md)', borderTopColor: 'var(--red)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 13 }}>Chargement…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
        Erreur : {error}
      </div>
    )
  }

  const {
    totalAllTime,
    total,
    nouveaux,
    convertis,
    perdus,
    tauxConversion,
    comparisons,
    funnel,
    types,
    relances,
    actionItems,
    quality,
    sourcePerformance,
    finance,
    parEtab,
    pipelineHealth,
  } = stats

  const qualityMax = Math.max(...quality.map(item => item.count), 1)
  const openLeads = ({ filters = {}, quickView = 'all' } = {}) => onOpenLeads?.({ filters, quickView })

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 1220, margin: '0 auto', padding: '24px 24px 36px' }}>
        <div style={{
          marginBottom: 18,
          padding: mobile ? '16px' : '18px 20px',
          borderRadius: 18,
          border: '1px solid var(--border)',
          background: 'radial-gradient(circle at top right, rgba(79,127,243,0.12), transparent 26%), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
          boxShadow: 'var(--shadow-soft)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--blue)', marginBottom: 8 }}>
                CRM Analytics
              </div>
              <h2 style={{ fontSize: mobile ? 20 : 22, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Cockpit commercial</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 520, lineHeight: 1.55 }}>
                Vue de pilotage des leads et du pipeline. {totalAllTime} leads au total dans le CRM.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: mobile ? '100%' : 'auto' }}>
              <div style={{ padding: '8px 11px', borderRadius: 14, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)', minWidth: 110, flex: mobile ? '1 1 0' : '0 0 auto' }}>
                <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Période</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{DASHBOARD_PERIODS.find(period => period.key === periodKey)?.label}</div>
              </div>
              <div style={{ padding: '8px 11px', borderRadius: 14, border: '1px solid rgba(34,197,94,0.18)', background: 'rgba(34,197,94,0.08)', minWidth: 110, flex: mobile ? '1 1 0' : '0 0 auto' }}>
                <div style={{ fontSize: 10, color: 'rgba(34,197,94,0.72)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Pipeline</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>{fmtEur(finance.pipelinePondere)}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: mobile ? 'nowrap' : 'wrap', overflowX: mobile ? 'auto' : 'visible', paddingBottom: mobile ? 2 : 0 }}>
            {DASHBOARD_PERIODS.map(period => (
              <FilterChip key={period.key} active={periodKey === period.key} label={period.label} onClick={() => setPeriodKey(period.key)} />
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 16 }}>
          <KpiCard label="Leads" value={total} accent="var(--text)" delta={fmtDelta(comparisons.total)} onClick={() => openLeads()} />
          <KpiCard label="Nouveaux" value={nouveaux} accent="var(--blue)" delta={fmtDelta(comparisons.nouveaux)} onClick={() => openLeads({ quickView: 'new' })} />
          <KpiCard label="Convertis" value={convertis} accent="var(--green)" delta={fmtDelta(comparisons.convertis)} onClick={() => openLeads({ quickView: 'converted' })} />
          <KpiCard label="Perdus" value={perdus} accent="var(--red)" onClick={() => openLeads({ filters: { statut: 'Perdu' } })} />
          <KpiCard
            label="Taux de conversion"
            value={fmtPct(tauxConversion)}
            accent="var(--amber)"
            sub={`${convertis} converti${convertis > 1 ? 's' : ''} / ${total}`}
            onClick={() => openLeads()}
          />
        </div>

        {actionItems.length > 0 && (
          <SectionCard>
            <SectionHeading action={<ActionLink onClick={() => openLeads({ quickView: 'follow_up' })}>Voir les leads</ActionLink>}>
              À traiter aujourd’hui
            </SectionHeading>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {actionItems.map(item => (
                <ActionCard
                  key={item.key}
                  item={item}
                  stretch={actionItems.length === 1}
                  onClick={() => openLeads({ quickView: item.quickView })}
                />
              ))}
            </div>
          </SectionCard>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 16 }}>
          <SectionCard>
            <SectionHeading action={<ActionLink onClick={() => openLeads()}>Ouvrir la liste</ActionLink>}>
              Entonnoir de conversion
            </SectionHeading>
            {funnel.map(stage => (
              <button
                key={stage.key}
                onClick={() => openLeads({ filters: { statut: stage.key } })}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ width: 150, fontSize: 12, color: 'var(--muted)', textAlign: 'right', flexShrink: 0, lineHeight: 1.3 }}>{stage.label}</div>
                <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,0.045)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max(stage.pct, stage.count > 0 ? 2 : 0)}%`, background: STATUT_COLORS[stage.key] || 'var(--muted2)', borderRadius: 999 }} />
                </div>
                <div style={{ width: 28, fontSize: 12, fontWeight: 600, color: 'var(--text)', textAlign: 'right', flexShrink: 0 }}>{stage.count}</div>
              </button>
            ))}
          </SectionCard>

          <SectionCard>
            <SectionHeading>Type de client</SectionHeading>
            {types.map(type => (
              <div key={type.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 110, fontSize: 12, color: 'var(--muted)' }}>{type.key}</div>
                <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.045)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(type.pct, type.count > 0 ? 4 : 0)}%`, height: '100%', background: type.key === 'Particulier' ? 'var(--amber)' : 'var(--blue)', borderRadius: 999 }} />
                </div>
                <div style={{ width: 28, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>{type.count}</div>
              </div>
            ))}
          </SectionCard>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 16 }}>
          <SectionCard>
            <SectionHeading action={<ActionLink onClick={() => openLeads({ quickView: 'no_next_step' })}>Corriger le CRM</ActionLink>}>
              Qualité CRM
            </SectionHeading>
            {quality.map(item => (
              <QualityRow key={item.key} item={item} maxCount={qualityMax} onClick={() => openLeads({ quickView: item.quickView })} />
            ))}
          </SectionCard>

          <SectionCard>
            <SectionHeading>Âge du pipeline</SectionHeading>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <KpiCard label="Âge moyen actif" value={`${pipelineHealth.averageActiveAgeDays} j`} accent="var(--text)" />
              <KpiCard label="Opportunités > 14j" value={pipelineHealth.staleOpportunitiesCount} accent="var(--amber)" />
              <KpiCard label="Relances > 14j" value={pipelineHealth.staleRelancesCount} accent="var(--red)" />
            </div>
          </SectionCard>
        </div>

        <SectionCard style={{ marginTop: 16 }}>
          <SectionHeading>Performance par source</SectionHeading>
          {mobile ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {sourcePerformance.map(source => (
                <div key={source.key} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{source.label}</div>
                    <ActionLink onClick={() => openLeads({ filters: { source: source.key } })}>Voir</ActionLink>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Leads: <span style={{ color: 'var(--text)' }}>{source.count}</span></div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Convertis: <span style={{ color: 'var(--text)' }}>{source.convertis}</span></div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Taux: <span style={{ color: 'var(--text)' }}>{fmtPct(source.taux)}</span></div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Pipeline: <span style={{ color: 'var(--text)' }}>{fmtEur(source.pipeline)}</span></div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>CA réel: <span style={{ color: 'var(--text)' }}>{fmtEur(source.ca)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead>
                <tr>
                  {['Source', 'Leads', 'Convertis', 'Taux', 'Pipeline', 'CA réel', ''].map(head => (
                    <th key={head} style={{ textAlign: 'left', padding: '0 0 10px', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid var(--border)' }}>
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sourcePerformance.map(source => (
                  <tr key={source.key} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '9px 0', fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{source.label}</td>
                    <td style={{ padding: '9px 0', fontSize: 12 }}>{source.count}</td>
                    <td style={{ padding: '9px 0', fontSize: 12 }}>{source.convertis}</td>
                    <td style={{ padding: '9px 0', fontSize: 12 }}>{fmtPct(source.taux)}</td>
                    <td style={{ padding: '9px 0', fontSize: 12 }}>{fmtEur(source.pipeline)}</td>
                    <td style={{ padding: '9px 0', fontSize: 12 }}>{fmtEur(source.ca)}</td>
                    <td style={{ padding: '9px 0', textAlign: 'right' }}>
                      <ActionLink onClick={() => openLeads({ filters: { source: source.key } })}>Voir</ActionLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </SectionCard>

        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 16 }}>
          <SectionCard>
            <SectionHeading action={<ActionLink onClick={() => openLeads({ quickView: 'follow_up' })}>Voir tous</ActionLink>}>
              Leads à relancer
            </SectionHeading>
            {relances.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '20px 0', margin: 0 }}>
                Aucun lead à relancer
              </p>
            ) : (
              mobile ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {relances.slice(0, 8).map((lead, index) => {
                    const name = [lead.prenom, lead.nom].filter(Boolean).join(' ') || lead.email || lead.nomEntreprise || '—'
                    return (
                      <div key={lead.id || index} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{name}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <StatutPill statut={lead.statut} />
                          <PrioriteBadge priorite={lead.priorite} />
                          <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>Relance {fmtDate(lead.dateRelance)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 430 }}>
                  <thead>
                    <tr>
                      {['Lead', 'Statut', 'Date de relance', 'Priorité'].map(head => (
                        <th key={head} style={{ textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)', padding: '0 8px 10px', borderBottom: '1px solid var(--border)' }}>
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {relances.slice(0, 8).map((lead, index) => {
                      const name = [lead.prenom, lead.nom].filter(Boolean).join(' ') || lead.email || lead.nomEntreprise || '—'
                      return (
                        <tr key={lead.id || index} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '9px 8px', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{name}</td>
                          <td style={{ padding: '9px 8px' }}><StatutPill statut={lead.statut} /></td>
                          <td style={{ padding: '9px 8px', fontSize: 12, color: 'var(--red)', fontWeight: 500 }}>{fmtDate(lead.dateRelance)}</td>
                          <td style={{ padding: '9px 8px' }}><PrioriteBadge priorite={lead.priorite} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
              )
            )}
          </SectionCard>

          <SectionCard>
            <SectionHeading>Finance</SectionHeading>
            <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              <KpiCard label="Pipeline pondéré" value={fmtEur(finance.pipelinePondere)} accent="var(--green)" />
              <KpiCard label="CA réel" value={finance.caReel > 0 ? fmtEur(finance.caReel) : '—'} accent={finance.caReel > 0 ? 'var(--green)' : 'var(--muted2)'} delta={fmtDelta(comparisons.caReel, true)} />
              <KpiCard label="Devis estimés" value={fmtEur(finance.montantTotalEstime)} accent="var(--blue)" />
              <KpiCard label="Sans montant" value={finance.leadsSansMontantCount} accent="var(--amber)" onClick={() => openLeads({ quickView: 'missing_amount' })} />
              <KpiCard label="Ticket estimé" value={finance.ticketMoyenEstime > 0 ? fmtEur(finance.ticketMoyenEstime) : '—'} accent="var(--text)" />
              <KpiCard label="Ticket converti" value={finance.ticketMoyenConverti > 0 ? fmtEur(finance.ticketMoyenConverti) : '—'} accent="var(--text)" />
            </div>
          </SectionCard>
        </div>

        {parEtab.length > 0 && (
          <SectionCard style={{ marginTop: 16 }}>
            <SectionHeading>Performance par type d’établissement</SectionHeading>
            <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px 24px' }}>
              {parEtab.map(entry => (
                <div key={entry.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                  <div style={{ width: 130, fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>{entry.label}</div>
                  <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.045)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${entry.pct}%`, background: 'var(--blue)', borderRadius: 999 }} />
                  </div>
                  <div style={{ width: 24, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{entry.count}</div>
                  <div style={{ width: 42, textAlign: 'right', fontSize: 10, color: 'var(--green)' }}>{entry.taux} %</div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  )
}
