export default function Loading() {
  return (
    <div className="dj-page">
      <div
        style={{
          height: 40,
          width: 220,
          borderRadius: 999,
          background: "var(--card-alt)",
          marginBottom: 24,
        }}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
          gap: 16,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 120,
              borderRadius: 24,
              background: "var(--card)",
              border: "1px solid var(--border)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
