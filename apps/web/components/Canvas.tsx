"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MiniMap,
  ReactFlow,
  type ReactFlowInstance,
} from "@xyflow/react";
import { useSasori, type RFNode } from "@/lib/store";
import { AgentNode, HumanNode, InputNode, OutputNode } from "./nodes";

export function Canvas() {
  const initialFitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodes = useSasori((s) => s.nodes);
  const edges = useSasori((s) => s.edges);
  const running = useSasori((s) => s.running);
  const onNodesChange = useSasori((s) => s.onNodesChange);
  const onEdgesChange = useSasori((s) => s.onEdgesChange);
  const onConnect = useSasori((s) => s.onConnect);
  const select = useSasori((s) => s.select);

  const nodeTypes = useMemo(
    () => ({
      "input-node": InputNode,
      "agent-node": AgentNode,
      "human-node": HumanNode,
      "output-node": OutputNode,
    }),
    [],
  );

  useEffect(
    () => () => {
      if (initialFitTimer.current) clearTimeout(initialFitTimer.current);
    },
    [],
  );

  const fitLoadedFlow = (instance: ReactFlowInstance<RFNode>) => {
    // O fluxo salvo chega depois da primeira pintura; reenquadra uma única vez
    // para os cards maiores não nascerem cortados nas bordas do canvas.
    initialFitTimer.current = setTimeout(() => {
      void instance.fitView({ padding: 0.035, maxZoom: 0.95, duration: 280 });
    }, 500);
  };

  return (
    <ReactFlow<RFNode, Edge>
      nodes={nodes}
      edges={edges.map((e) => ({ ...e, animated: running }))}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={(_, n) => select(n.id)}
      onPaneClick={() => select(null)}
      onInit={fitLoadedFlow}
      fitView
      fitViewOptions={{ padding: 0.035, maxZoom: 0.95 }}
      proOptions={{ hideAttribution: true }}
      deleteKeyCode={["Backspace", "Delete"]}
    >
      <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="#2a2318" />
      <Controls
        position="bottom-left"
        showInteractive={false}
        fitViewOptions={{ padding: 0.035, maxZoom: 0.95 }}
      />
      <MiniMap
        position="bottom-right"
        pannable
        zoomable
        nodeColor="#3a3020"
        maskColor="rgba(20,17,13,.7)"
      />
    </ReactFlow>
  );
}
