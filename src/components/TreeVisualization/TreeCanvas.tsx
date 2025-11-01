'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { EventNode } from '@/types/tree';
import { calculateTreeLayout } from '@/lib/layout/depth-layout';
import { findMostProbablePath } from '@/lib/tree/path-finder';
import { calculateCumulativeProbabilities, verifyProbabilitySum } from '@/lib/tree/probability-calculator';
import EventNodeComponent from './NodeTypes/EventNode';
import SeedNodeComponent from './NodeTypes/SeedNode';
import ProbabilityEdge from './EdgeTypes/ProbabilityEdge';
import NodeDetailsPanel from './NodeDetailsPanel';

interface Props {
  tree: EventNode;
}

const nodeTypes = {
  event: EventNodeComponent,
  seed: SeedNodeComponent,
};

const edgeTypes = {
  probability: ProbabilityEdge,
};

export default function TreeVisualization({ tree }: Props) {
  const [selectedNode, setSelectedNode] = useState<EventNode | null>(null);
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal' | 'radial'>('radial');

  // Find most probable path
  const mostProbablePath = useMemo(() => findMostProbablePath(tree), [tree]);

  // Calculate cumulative probabilities
  const cumulativeProbabilities = useMemo(() => calculateCumulativeProbabilities(tree), [tree]);

  // Verify probability sum
  const probabilitySum = useMemo(() => verifyProbabilitySum(tree), [tree]);

  // Calculate layout (recalculates whenever tree changes)
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () =>
      calculateTreeLayout(tree, {
        depthSpacing: 450,
        childSpacing: 300,
        orientation,
      }, mostProbablePath, cumulativeProbabilities),
    [tree, orientation, mostProbablePath, cumulativeProbabilities]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes/edges when tree changes
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = calculateTreeLayout(tree, {
      depthSpacing: 450,
      childSpacing: 300,
      orientation,
    }, mostProbablePath, cumulativeProbabilities);

    setNodes(newNodes);
    setEdges(newEdges);
  }, [tree, orientation, mostProbablePath, cumulativeProbabilities, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: any, node: any) => {
      const eventNode = findNodeById(tree, node.id);
      setSelectedNode(eventNode);
    },
    [tree]
  );

  const toggleOrientation = () => {
    setOrientation(prev => {
      if (prev === 'radial') return 'vertical';
      if (prev === 'vertical') return 'horizontal';
      return 'radial';
    });
  };

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Background />
        <Controls />

        <Panel position="top-right" className="flex flex-col gap-2">
          <button
            onClick={toggleOrientation}
            className="rounded-md bg-gray-800/70 px-3 py-2 text-sm font-medium text-gray-300 shadow-md hover:bg-gray-700/70 border border-gray-700/50"
          >
            {orientation === 'radial' ? 'Radial' : orientation === 'vertical' ? 'Vertical' : 'Horizontal'}
          </button>

          {/* Probability verification panel */}
          <div className={`rounded-md px-3 py-2 text-xs font-medium shadow-md ${
            probabilitySum.isValid
              ? 'bg-green-900/30 text-green-400 border border-green-700/50'
              : 'bg-orange-900/30 text-orange-400 border border-orange-700/50'
          }`}>
            <div className="font-bold">Leaf Sum</div>
            <div>{(probabilitySum.sum * 100).toFixed(2)}%</div>
            {probabilitySum.isValid && <div className="text-green-400">✓ Valid</div>}
          </div>
        </Panel>
      </ReactFlow>

      {selectedNode && (
        <NodeDetailsPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}

function findNodeById(root: EventNode, id: string): EventNode | null {
  if (root.id === id) return root;

  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }

  return null;
}
