"use client";

import { useMemo } from "react";
import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow } from "@xyflow/react";
import { useSasori } from "@/lib/store";
import { AgentNode, HumanNode, InputNode, OutputNode } from "./nodes";

export function Canvas() {
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

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges.map((e) => ({ ...e, animated: running }))}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={(_, n) => select(n.id)}
      onPaneClick={() => select(null)}
      fitView
      proOptions={{ hideAttribution: true }}
      deleteKeyCode={["Backspace", "Delete"]}
    >
      <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="#2a2318" />
      <Controls position="bottom-left" showInteractive={false} />
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
