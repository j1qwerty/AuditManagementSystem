// Hand-rolled SVG chart components (no chart library, no animations).
// Clean, minimal, readable - suitable for an audit platform.
import { useId } from 'react'

export const CHART_COLORS = ['#116a5b', '#175cd3', '#b54708', '#6941c6', '#b42318', '#0e7490', '#93370d', '#475467']

// ---------------- vertical bar chart ----------------
export function BarChart({ data, height = 210, formatValue = (v) => v, horizontalLabels = false }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const barW = 100 / (data.length * 1.6)
  const gap = barW * 0.6
  return (
    <div>
      <svg viewBox={`0 0 100 ${height / 3}`} preserveAspectRatio="none" style={{ width: '100%', height: height * 0.72 }}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1="0" x2="100" y1={(height / 3) * (1 - f)} y2={(height / 3) * (1 - f)} stroke="#e9edf0" strokeWidth="0.25" />
        ))}
        {data.map((d, i) => {
          const h = (d.value / max) * (height / 3 - 2)
          return (
            <rect
              key={i}
              x={i * (barW + gap) + gap / 2}
              y={height / 3 - h}
              width={barW}
              height={Math.max(h, 0.4)}
              fill={d.color || CHART_COLORS[i % CHART_COLORS.length]}
              rx="0.5"
            >
              <title>{`${d.label}: ${formatValue(d.value)}`}</title>
            </rect>
          )
        })}
      </svg>
      <div style={{ display: 'flex', fontSize: 11, color: 'var(--text-2)', marginTop: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ width: `${100 / data.length}%`, textAlign: 'center', overflow: 'hidden', padding: '0 2px' }}>
            {horizontalLabels ? d.label : d.label.split(' ')}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------- horizontal bar chart ----------------
export function HBarChart({ data, formatValue = (v) => v, showPct }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 200px) 1fr auto', gap: 10, alignItems: 'center', fontSize: 12.5 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.label}>{d.label}</span>
          <div style={{ background: 'var(--neutral-soft)', borderRadius: 4, height: 12 }}>
            <div style={{ width: `${(d.value / max) * 100}%`, minWidth: 2, background: d.color || CHART_COLORS[i % CHART_COLORS.length], borderRadius: 4, height: '100%' }} />
          </div>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
            {showPct ? `${d.value}%` : formatValue(d.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------- line chart (supports a second dashed projection series) ----------------
export function LineChart({ data, height = 200, yFormat = (v) => v, projection = [], min, max: maxOverride }) {
  const gid = useId().replace(/:/g, '')
  const all = [...data, ...projection]
  const max = maxOverride !== undefined ? maxOverride : Math.max(...all, 1) * 1.12
  const lo = min !== undefined ? min : 0
  const W = 100
  const H = height / 2.2
  const n = data.length + projection.length
  const x = (i) => (n <= 1 ? 0 : (i / (n - 1)) * W)
  const y = (v) => H - ((v - lo) / (max - lo || 1)) * H
  const path = (pts) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(p).toFixed(2)}`).join(' ')
  const labels = [...data.map((d) => d.label), ...projection.map((_, i) => `+${i + 1}m`)]
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#116a5b" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#116a5b" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="#e9edf0" strokeWidth="0.25" />
        ))}
        {data.length > 1 && (
          <>
            <path d={`${path(data)} L ${x(data.length - 1)} ${H} L 0 ${H} Z`} fill={`url(#g${gid})`} stroke="none" />
            <path d={path(data)} fill="none" stroke="#116a5b" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
          </>
        )}
        {projection.length > 0 && (
          <>
            {data.length > 0 && (
              <path
                d={`M ${x(data.length - 1)} ${y(data[data.length - 1])} ${projection.map((p, i) => `L ${x(data.length + i)} ${y(p)}`).join(' ')}`}
                fill="none" stroke="#b54708" strokeWidth="0.8" strokeDasharray="2.5 2" vectorEffect="non-scaling-stroke"
              />
            )}
            {projection.map((p, i) => (
              <circle key={i} cx={x(data.length + i)} cy={y(p)} r="0.9" fill="#b54708" />
            ))}
          </>
        )}
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.value !== undefined ? d.value : d)} r="0.9" fill="#116a5b" />
        ))}
      </svg>
      <div style={{ display: 'flex', fontSize: 10.5, color: 'var(--text-2)', marginTop: 4 }}>
        {labels.map((l, i) => (
          <div key={i} style={{ width: `${100 / labels.length}%`, textAlign: 'center' }}>{l}</div>
        ))}
      </div>
    </div>
  )
}

// ---------------- donut chart ----------------
export function DonutChart({ data, size = 150, centerLabel, centerValue }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = 38
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
      <svg viewBox="0 0 100 100" style={{ width: size, height: size }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#eef1f5" strokeWidth="14" />
        {data.map((d, i) => {
          if (d.value <= 0) return null
          const len = (d.value / total) * c
          const el = (
            <circle
              key={i} cx="50" cy="50" r={r} fill="none"
              stroke={d.color || CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth="14" strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset} transform="rotate(-90 50 50)"
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </circle>
          )
          offset += len
          return el
        })}
        {centerValue !== undefined && (
          <>
            <text x="50" y="49" textAnchor="middle" style={{ fontSize: 15, fontWeight: 700, fill: '#1c2430' }}>{centerValue}</text>
            <text x="50" y="59" textAnchor="middle" style={{ fontSize: 6.5, fill: '#8a93a1' }}>{centerLabel}</text>
          </>
        )}
      </svg>
      <div className="chart-legend" style={{ flexDirection: 'column', gap: 6, marginTop: 0 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}>
            <span className="sw" style={{ background: d.color || CHART_COLORS[i % CHART_COLORS.length], width: 11, height: 11 }} />
            <span style={{ color: 'var(--text-2)', minWidth: 82 }}>{d.label}</span>
            <b style={{ color: 'var(--text)' }}>{d.value}</b>
            <span className="muted">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------- risk heatmap (5x5) ----------------
export function RiskHeatmap({ cells, onCellClick }) {
  // cells: [{ likelihood, impact, items: [] }]
  const colors = ['#e7f5ee', '#f2f7e3', '#fef3e2', '#fde8d7', '#fdebe9']
  const textColors = ['#067647', '#4d7c0f', '#b54708', '#c2410c', '#b42318']
  const L = ['Very Low', 'Low', 'Medium', 'High', 'Very High']
  const IMPACT = [1, 2, 3, 4, 5]
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '74px repeat(5, minmax(64px, 1fr))', gap: 4, fontSize: 11 }}>
        <div />
        {L.map((l) => (
          <div key={l} className="center" style={{ color: 'var(--text-3)', fontWeight: 600, padding: '3px 0' }}>{l}</div>
        ))}
        {[5, 4, 3, 2, 1].map((impact) => (
          <div key={impact} style={{ display: 'contents' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6, color: 'var(--text-3)', fontWeight: 600 }}>
              {L[impact - 1]}
            </div>
            {IMPACT.map((likelihood) => {
              const cell = cells.find((c) => c.impact === impact && c.likelihood === likelihood)
              const score = (impact - 1) * 5 + (likelihood - 1)
              const level = Math.min(4, Math.floor(score / 5))
              return (
                <div
                  key={likelihood}
                  title={cell ? cell.items.map((i) => i.title || i.name).join('\n') : ''}
                  onClick={cell && onCellClick ? () => onCellClick(cell) : undefined}
                  style={{
                    background: colors[level], color: textColors[level], borderRadius: 6, padding: '7px 4px',
                    textAlign: 'center', fontWeight: 700, minHeight: 40, cursor: cell ? 'pointer' : 'default',
                    border: '1px solid rgba(0,0,0,0.05)'
                  }}
                >
                  {cell ? cell.items.length : ''}
                </div>
              )
            })}
          </div>
        ))}
        <div />
        <div className="center muted" style={{ gridColumn: 'span 5', fontWeight: 600, paddingTop: 2 }}>Likelihood →</div>
      </div>
    </div>
  )
}
