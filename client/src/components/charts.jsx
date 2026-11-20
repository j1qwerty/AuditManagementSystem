// Hand-rolled chart components (no chart library, no fancy animations).
// Every chart supports: hover tooltip with details + click-to-navigate.
import { useId, useState, useCallback } from 'react'

export const CHART_COLORS = ['#8b53ac', '#0084ff', '#ff3381', '#0488fb', '#ba98cd', '#ff66a1', '#0f9d6e', '#d97706', '#68b7fd', '#70428a']

// ---------------- shared tooltip ----------------
// usage: const tip = useChartTip(); <div {...tip.bind(item)}>...</div>
export function useChartTip() {
  const [tip, setTip] = useState(null)
  const bind = useCallback((item) => ({
    onMouseEnter: (e) => {
      const x = Math.min(e.clientX + 14, window.innerWidth - 280)
      const y = Math.min(e.clientY + 12, window.innerHeight - 90)
      setTip({ x, y, item })
    },
    onMouseMove: (e) => {
      const x = Math.min(e.clientX + 14, window.innerWidth - 280)
      const y = Math.min(e.clientY + 12, window.innerHeight - 90)
      setTip((t) => (t ? { ...t, x, y } : { x, y, item }))
    },
    onMouseLeave: () => setTip(null)
  }), [])
  const el = tip ? (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>
      <div className="ct-title">{tip.item.title}</div>
      {(tip.item.rows || []).map((r, i) => (
        <div key={i} className="ct-row"><span>{r[0]}</span><b>{r[1]}</b></div>
      ))}
      {tip.item.foot && <div style={{ marginTop: 3, opacity: 0.75, fontSize: 10.5 }}>{tip.item.foot}</div>}
      {tip.item.clickHint && <div style={{ marginTop: 3, fontSize: 10, color: '#d1bade' }}>Click to open ↗</div>}
    </div>
  ) : null
  return { el, bind }
}

// ---------------- vertical bar chart (HTML, hover + click) ----------------
export function BarChart({ data, height = 200, formatValue = (v) => v, onItemClick }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const tip = useChartTip()
  return (
    <div style={{ position: 'relative' }}>
      {tip.el}
      <div className="vbar" style={{ height }}>
        {data.map((d, i) => {
          const h = Math.max((d.value / max) * (height - 34), d.value > 0 ? 4 : 1)
          const item = {
            title: d.label,
            rows: d.rows || [[d.valueLabel || 'Value', formatValue(d.value)]],
            foot: d.foot,
            clickHint: !!onItemClick
          }
          return (
            <div
              key={i}
              className="vb-col"
              {...tip.bind(item)}
              onClick={onItemClick ? () => onItemClick(d) : undefined}
              style={{ cursor: onItemClick ? 'pointer' : 'default' }}
            >
              <span className="vb-val">{d.valueLabel === false ? '' : formatValue(d.value)}</span>
              <div className="vb-bar" style={{ height: h, background: d.color || CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="vb-label">{d.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------- horizontal bar chart (rows, hover + click) ----------------
export function HBarChart({ data, formatValue = (v) => v, showPct, onItemClick }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const tip = useChartTip()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {data.map((d, i) => (
        <div
          key={i}
          style={{
            display: 'grid', gridTemplateColumns: 'minmax(120px, 190px) 1fr auto', gap: 10, alignItems: 'center',
            fontSize: 12.5, cursor: onItemClick ? 'pointer' : 'default', padding: '2px 4px', borderRadius: 6
          }}
          {...tip.bind({ title: d.label, rows: d.rows || [[d.valueLabel || 'Value', showPct ? `${d.value}%` : formatValue(d.value)]], foot: d.foot, clickHint: !!onItemClick })}
          onClick={onItemClick ? () => onItemClick(d) : undefined}
          className="chart-bar-seg"
        >
          <span className="ellipsis" style={{ fontWeight: 600, color: 'var(--text-2)' }}>{d.label}</span>
          <div style={{ background: 'var(--surface-2)', borderRadius: 4, height: 12 }}>
            <div style={{ width: `${(d.value / max) * 100}%`, minWidth: 2, background: d.color || CHART_COLORS[i % CHART_COLORS.length], borderRadius: 4, height: '100%' }} />
          </div>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)', whiteSpace: 'nowrap', fontWeight: 700 }}>
            {showPct ? `${d.value}%` : formatValue(d.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------- line chart (SVG, hover points + click, projection series) ----------------
export function LineChart({ data, height = 200, yFormat = (v) => v, projection = [], onItemClick, valueLabel = 'Value' }) {
  const gid = useId().replace(/:/g, '')
  const [hover, setHover] = useState(null)
  const tip = useChartTip()
  const all = [...data, ...projection]
  const max = Math.max(...all.map((d) => (d.value !== undefined ? d.value : d)), 1) * 1.12
  const W = 100
  const H = height / 2.2
  const n = data.length + projection.length
  const x = (i) => (n <= 1 ? 0 : (i / (n - 1)) * W)
  const y = (v) => H - (v / max) * H
  const path = (pts) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(p).toFixed(2)}`).join(' ')
  const labels = [...data.map((d) => d.label), ...projection.map((_, i) => `+${i + 1}m`)]

  const pointItem = (d, i) => ({
    title: d.label,
    rows: d.rows || [[valueLabel, yFormat(d.value !== undefined ? d.value : d)], ...(d.sub ? d.sub : [])],
    foot: d.foot,
    clickHint: !!onItemClick
  })

  return (
    <div style={{ position: 'relative' }}>
      {tip.el}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b53ac" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#8b53ac" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="#e9e1f0" strokeWidth="0.3" />
        ))}
        {data.length > 1 && (
          <>
            <path d={`${path(data.map((d) => d.value))} L ${x(data.length - 1)} ${H} L 0 ${H} Z`} fill={`url(#g${gid})`} stroke="none" />
            <path d={path(data.map((d) => d.value))} fill="none" stroke="#8b53ac" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </>
        )}
        {projection.length > 0 && data.length > 0 && (
          <path
            d={`M ${x(data.length - 1)} ${y(data[data.length - 1].value)} ${projection.map((p, i) => `L ${x(data.length + i)} ${y(p)}`).join(' ')}`}
            fill="none" stroke="#d97706" strokeWidth="1" strokeDasharray="2.5 2" vectorEffect="non-scaling-stroke"
          />
        )}
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.value)} r={hover === i ? '1.4' : '1'} fill="#70428a" />
        ))}
        {projection.map((p, i) => (
          <circle key={`p${i}`} cx={x(data.length + i)} cy={y(p)} r="1" fill="#d97706" />
        ))}
        {/* hover/click hit zones */}
        {data.map((d, i) => (
          <rect
            key={`h${i}`}
            x={x(i) - W / (2 * Math.max(n - 1, 1))} y="0" width={W / Math.max(n - 1, 1)} height={H}
            fill="transparent"
            onMouseEnter={(e) => setHover(i)}
            onMouseLeave={() => setHover(null)}
            {...tip.bind(pointItem(d, i))}
            onClick={onItemClick ? () => onItemClick(d) : undefined}
            style={{ cursor: onItemClick ? 'pointer' : 'default' }}
          />
        ))}
      </svg>
      <div style={{ display: 'flex', fontSize: 10.5, color: 'var(--text-3)', marginTop: 4 }}>
        {labels.map((l, i) => (
          <div key={i} style={{ width: `${100 / labels.length}%`, textAlign: 'center' }}>{l}</div>
        ))}
      </div>
    </div>
  )
}

// ---------------- donut chart (SVG, hover + click) ----------------
export function DonutChart({ data, size = 150, centerLabel, centerValue, onItemClick }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = 38
  const c = 2 * Math.PI * r
  let offset = 0
  const tip = useChartTip()
  return (
    <div style={{ position: 'relative' }}>
      {tip.el}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
        <svg viewBox="0 0 100 100" style={{ width: size, height: size }}>
          <circle cx="50" cy="50" r={r} fill="none" stroke="#f1ecf5" strokeWidth="14" />
          {data.map((d, i) => {
            if (d.value <= 0) return null
            const len = (d.value / total) * c
            const el = (
              <circle
                key={i} cx="50" cy="50" r={r} fill="none"
                stroke={d.color || CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth="14" strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset} transform="rotate(-90 50 50)"
                className="chart-bar-seg"
                {...tip.bind({
                  title: d.label,
                  rows: d.rows || [[d.valueLabel || 'Count', d.value], ['Share', `${Math.round((d.value / total) * 100)}%`]],
                  foot: d.foot,
                  clickHint: !!onItemClick
                })}
                onClick={onItemClick ? () => onItemClick(d) : undefined}
                style={{ cursor: onItemClick ? 'pointer' : 'default' }}
              />
            )
            offset += len
            return el
          })}
          {centerValue !== undefined && (
            <>
              <text x="50" y="49" textAnchor="middle" style={{ fontSize: 15, fontWeight: 700, fill: '#241730' }}>{centerValue}</text>
              <text x="50" y="59" textAnchor="middle" style={{ fontSize: 6.5, fill: '#8d7f9a' }}>{centerLabel}</text>
            </>
          )}
        </svg>
        <div className="chart-legend" style={{ flexDirection: 'column', gap: 6, marginTop: 0, alignItems: 'flex-start' }}>
          {data.map((d, i) => (
            <div
              key={i}
              className={onItemClick ? 'chart-bar-seg' : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, cursor: onItemClick ? 'pointer' : 'default' }}
              onClick={onItemClick ? () => onItemClick(d) : undefined}
              {...tip.bind({ title: d.label, rows: [[d.valueLabel || 'Count', d.value], ['Share', `${Math.round((d.value / total) * 100)}%`]], clickHint: !!onItemClick })}
            >
              <span className="sw" style={{ background: d.color || CHART_COLORS[i % CHART_COLORS.length], width: 11, height: 11 }} />
              <span style={{ color: 'var(--text-2)', minWidth: 82 }}>{d.label}</span>
              <b style={{ color: 'var(--text)' }}>{d.value}</b>
              <span className="muted">{Math.round((d.value / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------- risk heatmap (5x5, hover + click) ----------------
export function RiskHeatmap({ cells, onCellClick }) {
  const colors = ['#e7f6ef', '#f4f7e3', '#fdf3e3', '#ffe9ed', '#ffdce4']
  const textColors = ['#0b7f58', '#4d7c0f', '#b45f06', '#c21f38', '#cc004e']
  const L = ['Very Low', 'Low', 'Medium', 'High', 'Very High']
  const IMPACT = [1, 2, 3, 4, 5]
  const tip = useChartTip()
  return (
    <div style={{ position: 'relative' }}>
      {tip.el}
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
                    className={cell && onCellClick ? 'heat-cell clickable' : 'heat-cell'}
                    {...(cell ? tip.bind({
                      title: `Impact ${L[impact - 1]} · Likelihood ${L[likelihood - 1]}`,
                      rows: [['Items', cell.items.length], ...cell.items.slice(0, 5).map((it) => [it.title || it.name || 'Item', ''])],
                      foot: cell.items.length > 5 ? `+${cell.items.length - 5} more` : '',
                      clickHint: !!onCellClick
                    }) : {})}
                    onClick={cell && onCellClick ? () => onCellClick(cell) : undefined}
                    style={{ background: colors[level], color: textColors[level], padding: '7px 4px', minHeight: 40 }}
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
    </div>
  )
}

// ---------------- sparkline (tiny trend in stat cards) ----------------
export function Sparkline({ points, color = '#8b53ac', height = 34 }) {
  const max = Math.max(...points, 1)
  const W = 100
  const H = 20
  const x = (i) => (points.length <= 1 ? 0 : (i / (points.length - 1)) * W)
  const y = (v) => H - (v / max) * H
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(p).toFixed(2)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
