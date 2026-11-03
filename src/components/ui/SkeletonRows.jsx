import React from 'react';

export default function SkeletonRows({ cols }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, r) => (
        <tr key={r} aria-hidden="true">
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} className="px-3 py-3">
              <div
                className="h-3 animate-pulse rounded bg-k-hairline"
                style={{ width: c === 0 ? '70%' : '45%' }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
