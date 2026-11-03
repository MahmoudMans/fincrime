export type ChartTone =
  | "danger"
  | "warning"
  | "info"
  | "ok"
  | "violet"
  | "neutral";

export interface BarItem {
  key: string;
  label: string;
  value: number;
  tone?: ChartTone;
  hint?: string;
}

/**
 * Horizontal bars with the numbers beside them. Pass `onSelect` to
 * make each row a button (e.g. to filter a list by that bar).
 */
export function BarList({
  items,
  label,
  onSelect,
  formatValue = (value: number) => value.toLocaleString(),
}: {
  items: readonly BarItem[];
  label: string;
  onSelect?: (key: string) => void;
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(0, ...items.map((item) => item.value));

  return (
    <ul className="ui-bars" aria-label={label}>
      {items.map((item) => {
        const width = max === 0 ? 0 : (item.value / max) * 100;

        const content = (
          <>
            <span className="ui-bar-label">{item.label}</span>

            <span className="ui-bar-track" aria-hidden="true">
              <span
                className="ui-bar-fill"
                style={{ width: `${width}%` }}
              />
            </span>

            <span className="ui-bar-value">
              {formatValue(item.value)}
            </span>
          </>
        );

        return (
          <li
            key={item.key}
            className="ui-bar-row"
            data-tone={item.tone ?? "info"}
            title={item.hint}
          >
            {onSelect ? (
              <button
                type="button"
                className="ui-bar-button"
                onClick={() => onSelect(item.key)}
              >
                {content}
              </button>
            ) : (
              <div className="ui-bar-plain">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export interface Segment {
  key: string;
  label: string;
  value: number;
  tone?: ChartTone;
}

/** One bar split into proportional segments, with a legend. */
export function StackedBar({
  segments,
  label,
}: {
  segments: readonly Segment[];
  label: string;
}) {
  const total = segments.reduce(
    (sum, segment) => sum + segment.value,
    0
  );

  return (
    <div className="ui-stack">
      <div
        className="ui-stack-bar"
        role="img"
        aria-label={`${label}: ${segments
          .map((segment) => `${segment.label} ${segment.value}`)
          .join(", ")}`}
      >
        {total === 0 ? (
          <span className="ui-stack-empty" />
        ) : (
          segments
            .filter((segment) => segment.value > 0)
            .map((segment) => (
              <span
                key={segment.key}
                className="ui-stack-segment"
                data-tone={segment.tone ?? "info"}
                style={{
                  width: `${(segment.value / total) * 100}%`,
                }}
              />
            ))
        )}
      </div>

      <ul className="ui-stack-legend">
        {segments.map((segment) => (
          <li
            key={segment.key}
            data-tone={segment.tone ?? "info"}
          >
            <span className="ui-stack-dot" aria-hidden="true" />
            {segment.label}
            <strong>{segment.value.toLocaleString()}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A small trend line. Needs at least two values to draw a line. */
export function Sparkline({
  values,
  label,
  tone = "info",
  width = 160,
  height = 40,
}: {
  values: readonly number[];
  label: string;
  tone?: ChartTone;
  width?: number;
  height?: number;
}) {
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const step =
    values.length > 1
      ? (width - pad * 2) / (values.length - 1)
      : 0;

  const points = values.map((value, index) => ({
    x: pad + index * step,
    y: pad + (1 - (value - min) / span) * (height - pad * 2),
  }));

  const line = points
    .map(
      (point) =>
        `${point.x.toFixed(1)},${point.y.toFixed(1)}`
    )
    .join(" ");

  const last = points[points.length - 1];

  return (
    <svg
      className="ui-spark"
      data-tone={tone}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
    >
      {points.length > 1 ? (
        <>
          <polygon
            className="ui-spark-area"
            points={`${pad},${height - pad} ${line} ${(
              pad +
              (points.length - 1) * step
            ).toFixed(1)},${height - pad}`}
          />

          <polyline className="ui-spark-line" points={line} />
        </>
      ) : (
        <line
          className="ui-spark-line"
          x1={pad}
          x2={width - pad}
          y1={height / 2}
          y2={height / 2}
        />
      )}

      {last && (
        <circle
          className="ui-spark-dot"
          cx={last.x}
          cy={last.y}
          r="2.6"
        />
      )}
    </svg>
  );
}
