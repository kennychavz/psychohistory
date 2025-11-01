'use client';

import { memo } from 'react';
import { Handle, Position } from 'reactflow';

interface SeedNodeData {
  event: string;
}

function SeedNode({ data }: { data: SeedNodeData }) {
  const { event } = data;

  return (
    <div
      className="rounded-lg border-4 border-purple-500 bg-gradient-to-br from-purple-50 to-blue-50 p-4 shadow-xl"
      style={{
        minWidth: 250,
        maxWidth: 300,
      }}
    >
      <div className="space-y-2">
        {/* Seed Badge */}
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-purple-600 px-3 py-1 text-xs font-bold text-white">
            SEED EVENT
          </span>
        </div>

        {/* Event Text */}
        <p className="text-base font-bold leading-tight text-gray-900">
          {event}
        </p>

        <p className="text-xs text-gray-600">
          Starting point for probability analysis
        </p>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-purple-600" />
    </div>
  );
}

export default memo(SeedNode);
