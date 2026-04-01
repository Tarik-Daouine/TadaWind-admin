import React from 'react'
import { useDashboardLeads } from '../../hooks/useDashboardLeads.js'

// ── Couleurs par statut ───────────────────────────────────────────────────────
const STATUT_COLORS = {
  'nouveau':           '#4f7ff3',
  'Prospect contacté': '#f59e0b',
  'À relancer':        '#f97316',
  'Opportunité':       '#22c55e',
  'Relancé':           '#a78bfa',
  'Converti':          '#16a34a',
  'Perdu':             '#6b7280',
}

const PRIORITE_COLORS = {
  'Haute':    '#bf1818',
  'Normale':  '#f59e0b',
  'Basse':    '#6b7280',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtEur(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function fmtPct(n, decimals = 1) {
  return Number(n).toFixed(decimals).replace('.', ',') + ' %'
}

function fmtDate(isoStr) {
  if (!isoStr) return '—'
  try {
    return new Date(isoStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return '—' }
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function SectionHeading({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.08em', color: 'var(--muted2)',
      marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {children}
    </div>
  )
}

function KpiCard({ label, value, accent, sub }) {
  return (
    <div style={{
      background: 'var(--s2)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${accent}`,
      borderRadius: 'var(--radius-lg)',
      padding: '18px 20px',
      minWidth: 0,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 28, fontWeight: 700, color: accent,
        fontFamily: 'var(--serif)', lineHeight: 1,
        marginBottom: sub ? 6 : 0,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--muted2)' }}>{sub}</div>
      )}
    </div>
  )
}

function HBar({ label, count, pct, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
      <div style={{
        width: 140, fontSize: 12, color: 'var(--muted)',
        textAlign: 'right', flexShrink: 0, lineHeight: 1.3,
      }}>
        {label}
      </div>
      <div style={{
        flex: 1, height: 7, background: 'var(--s3)',
        borderRadius: 4, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.max(pct, count > 0 ? 2 : 0)}%`,
          background: color,
          borderRadius: 4,
          transition: 'width 0.6s ease',
        }} />
      </div>
      <div style={{
        width: 28, fontSize: 12, fontWeight: 600,
        color: 'var(--text)', textAlign: 'right', flexShrink: 0,
      }}>
        {count}
      </div>
    </div>
  )
}

function StatutPill({ statut }) {
  const color = STATUT_COLORS[statut] || 'var(--muted)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20,
      border: `1px solid ${color}44`,
      background: `${color}18`,
      fontSize: 11, fontWeight: 500, color,
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
      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
      border: `1px solid ${color}44`, background: `${color}18`, color,
    }}>
      {priorite || '—'}
    </span>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { loading, error, stats } = useDashboardLeads()

  if (loading) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 12, color: 'var(--muted)',
      }}>
        <div style={{
          width: 20, height: 20,
          border: '2px solid var(--border-md)',
          borderTopColor: 'var(--red)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ fontSize: 13 }}>Chargement…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: 'var(--muted)', fontSize: 13,
      }}>
        Erreur : {error}
      </div>
    )
  }

  const { total, nouveaux, convertis, perdus, tauxConversion,
          funnel, sources, types, relances, finance } = stats
  const { hasMontants, pipelinePondere, caReel } = finance

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>

        {/* Titre */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Analytique
          </h2>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            Vue d'ensemble des leads — {total} au total
          </p>
        </div>

        {/* ── KPIs ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 14,
          marginBottom: 28,
        }}>
          <KpiCard label="Total leads"         value={total}                accent="var(--text)" />
          <KpiCard label="Nouveaux"             value={nouveaux}             accent="var(--blue)" />
          <KpiCard label="Convertis"            value={convertis}            accent="var(--green)" />
          <KpiCard label="Perdus"               value={perdus}               accent="var(--red)" />
          <KpiCard
            label="Taux de conversion"
            value={fmtPct(tauxConversion)}
            accent="var(--amber)"
            sub={`${convertis} converti${convertis !== 1 ? 's' : ''} / ${total}`}
          />
        </div>

        {/* ── Funnel + Source/Type ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Entonnoir */}
          <div style={{
            background: 'var(--s2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '20px 22px',
          }}>
            <SectionHeading>Entonnoir de conversion</SectionHeading>
            {funnel.map(stage => (
              <HBar
                key={stage.key}
                label={stage.label}
                count={stage.count}
                pct={stage.pct}
                color={STATUT_COLORS[stage.key] || 'var(--muted2)'}
              />
            ))}
          </div>

          {/* Source + Type de client */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: 'var(--s2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: '20px 22px', flex: 1,
            }}>
              <SectionHeading>Source</SectionHeading>
              {sources.map(s => (
                <HBar key={s.key} label={s.label} count={s.count} pct={s.pct} color="var(--blue)" />
              ))}
            </div>

            <div style={{
              background: 'var(--s2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: '20px 22px', flex: 1,
            }}>
              <SectionHeading>Type de client</SectionHeading>
              <HBar label="Particulier"   count={types[0].count} pct={types[0].pct} color="var(--amber)" />
              <HBar label="Professionnel" count={types[1].count} pct={types[1].pct} color="var(--blue)" />
            </div>
          </div>

        </div>

        {/* ── Leads à relancer ── */}
        <div style={{
          background: 'var(--s2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '20px 22px',
        }}>
          <SectionHeading>
            Leads à relancer
            {relances.length > 0 && (
              <span style={{
                fontSize: 9, fontWeight: 700, lineHeight: 1,
                background: 'var(--red)', color: '#fff',
                padding: '2px 6px', borderRadius: 20,
              }}>
                {relances.length}
              </span>
            )}
          </SectionHeading>

          {relances.length === 0 ? (
            <p style={{
              fontSize: 13, color: 'var(--muted)',
              textAlign: 'center', padding: '20px 0', margin: 0,
            }}>
              Aucun lead à relancer
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Lead', 'Statut', 'Date de relance', 'Priorité'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', fontSize: 10, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.07em',
                      color: 'var(--muted2)', padding: '0 8px 10px',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {relances.map((r, i) => {
                  const name = [r.prenom, r.nom].filter(Boolean).join(' ') || r.email || '—'
                  return (
                    <tr
                      key={i}
                      style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--s3)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <td style={{ padding: '9px 8px', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                        {name}
                      </td>
                      <td style={{ padding: '9px 8px' }}>
                        <StatutPill statut={r.statut} />
                      </td>
                      <td style={{ padding: '9px 8px', fontSize: 12, color: 'var(--red)', fontWeight: 500 }}>
                        {fmtDate(r.dateRelance)}
                      </td>
                      <td style={{ padding: '9px 8px' }}>
                        <PrioriteBadge priorite={r.priorite} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pipeline financier (affiché uniquement si des montants sont renseignés) ── */}
        {hasMontants && (
          <div style={{ marginTop: 20 }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
            }}>
              <div style={{
                background: 'var(--s2)', border: '1px solid var(--border)',
                borderLeft: '3px solid var(--green)',
                borderRadius: 'var(--radius-lg)', padding: '18px 20px',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 8 }}>
                  Pipeline pondéré
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--serif)', lineHeight: 1, marginBottom: 6 }}>
                  {fmtEur(pipelinePondere)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted2)' }}>
                  Σ(montant estimé × probabilité) — leads actifs
                </div>
              </div>

              <div style={{
                background: 'var(--s2)', border: '1px solid var(--border)',
                borderLeft: caReel > 0 ? '3px solid var(--green)' : '3px solid var(--border-strong)',
                borderRadius: 'var(--radius-lg)', padding: '18px 20px',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 8 }}>
                  CA réel encaissé
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, color: caReel > 0 ? 'var(--green)' : 'var(--muted2)', fontFamily: 'var(--serif)', lineHeight: 1, marginBottom: 6 }}>
                  {caReel > 0 ? fmtEur(caReel) : '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted2)' }}>
                  Σ montants réels — leads convertis
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
