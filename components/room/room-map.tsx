"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Segmented } from "@/components/segmented";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { NEXT_PRACTICE, governanceGraph, ownershipGraph, type MapGraph, type MapNode } from "@/lib/room/map";
import { simulate } from "@/lib/simulator/engine";
import { formatPercent } from "@/lib/simulator/format";
import { useSimulatorStore } from "@/lib/simulator/store";
import type { Severity } from "@/lib/simulator/types";
import { cn } from "@/lib/utils";

type View = "ownership" | "governance";
type Direction = "LR" | "TB";

const LAYOUTS: Record<View, { direction: Direction; positions: Record<string, { x: number; y: number }> }> = {
  ownership: {
    direction: "LR",
    positions: {
      founder: { x: 0, y: 0 },
      nextGen: { x: 0, y: 150 },
      others: { x: 0, y: 270 },
      equity: { x: 300, y: 120 },
      lenders: { x: 300, y: 300 },
      company: { x: 600, y: 200 },
    },
  },
  governance: {
    direction: "TB",
    positions: {
      shareholders: { x: 280, y: 0 },
      votingRules: { x: 0, y: 130 },
      buySellAgreement: { x: 280, y: 130 },
      disputeResolution: { x: 560, y: 130 },
      board: { x: 0, y: 270 },
      successionPlan: { x: 280, y: 270 },
      ceo: { x: 0, y: 410 },
      incapacitationPlan: { x: 280, y: 410 },
      delegationOfAuthority: { x: 0, y: 550 },
    },
  },
};

const TONE_BORDER: Record<MapNode["tone"], string> = {
  positive: "border-positive/60",
  caution: "border-caution/60",
  critical: "border-critical/60",
  metric: "border-metric/50",
  neutral: "border-border",
};
const TONE_TEXT: Record<MapNode["tone"], string> = {
  positive: "text-positive",
  caution: "text-caution",
  critical: "text-critical",
  metric: "text-metric",
  neutral: "text-muted-foreground",
};
const EDGE_COLOR: Record<Severity, string> = { positive: "var(--positive)", caution: "var(--caution)", critical: "var(--critical)" };

interface CardData extends Record<string, unknown> {
  node: MapNode;
  direction: Direction;
  onCycle?: () => void;
  transfer?: { value: number; onChange: (value: number) => void };
}

function TransferControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const labelId = useId();
  return (
    <div className="nodrag nopan mt-2 grid gap-1.5 border-t border-border pt-2">
      <div className="flex items-baseline justify-between gap-2">
        <span id={labelId} className="text-[0.6875rem] text-muted-foreground">
          Transfer to heir
        </span>
        <span className="font-mono text-[0.6875rem] text-metric">{formatPercent(value)}</span>
      </div>
      <Slider
        aria-labelledby={labelId}
        min={0}
        max={1}
        step={0.05}
        value={[value]}
        onValueChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
      />
    </div>
  );
}

function CardNode({ data }: NodeProps<Node<CardData>>) {
  const { node, direction, onCycle, transfer } = data;
  const [target, source] = direction === "LR" ? [Position.Left, Position.Right] : [Position.Top, Position.Bottom];
  const body = (
    <>
      <span className="text-xs font-medium text-foreground">{node.title}</span>
      {node.lines.map((line, i) => (
        <span key={line} className={cn("font-mono text-[0.6875rem] tabular-nums", i === 0 ? TONE_TEXT[node.tone] : "text-muted-foreground")}>
          {line}
        </span>
      ))}
    </>
  );
  return (
    <div className={cn("w-52 rounded-lg border bg-card px-3 py-2 shadow-sm", TONE_BORDER[node.tone])}>
      <Handle type="target" position={target} className="!size-1.5 !border-0 !bg-border" />
      {onCycle ? (
        <button
          type="button"
          onClick={onCycle}
          className="nodrag grid w-full gap-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${node.title}: ${node.lines[0]}. Click to change.`}
        >
          {body}
          <span className="text-[0.625rem] text-muted-foreground/70">Click to change</span>
        </button>
      ) : (
        <div className="grid gap-0.5">{body}</div>
      )}
      {transfer && <TransferControl value={transfer.value} onChange={transfer.onChange} />}
      <Handle type="source" position={source} className="!size-1.5 !border-0 !bg-border" />
      {direction === "TB" && (
        <>
          {/* Side handles for links between nodes on the same row. */}
          <Handle id="side-in" type="target" position={Position.Left} className="!size-1.5 !border-0 !bg-border" />
          <Handle id="side-out" type="source" position={Position.Right} className="!size-1.5 !border-0 !bg-border" />
        </>
      )}
    </div>
  );
}

const NODE_TYPES = { card: CardNode };

/** Nodes this close vertically sit on the same row of a top-down layout. */
const SAME_ROW = 40;

function toEdges(graph: MapGraph, layout: (typeof LAYOUTS)[View]): Edge[] {
  return graph.edges.map((e) => {
    const color = e.tone ? EDGE_COLOR[e.tone] : "var(--muted-foreground)";
    const [from, to] = [layout.positions[e.source], layout.positions[e.target]];
    const sideways = layout.direction === "TB" && from && to && Math.abs(from.y - to.y) < SAME_ROW;
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      ...(sideways ? { sourceHandle: "side-out", targetHandle: "side-in" } : {}),
      label: e.label,
      animated: e.tone === "critical",
      style: { stroke: color, strokeWidth: 1 + 3 * (e.weight ?? 0.25), opacity: 0.8 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
      labelStyle: { fill: "var(--muted-foreground)", fontSize: 10 },
      labelBgStyle: { fill: "var(--card)" },
    };
  });
}

/**
 * Drag-and-drop canvas for the Decision Room: the ownership cascade (with a
 * live equity-transfer control) and the governance tree (click a practice to
 * change it). Edits go to the shared store, so every module updates.
 */
export function RoomMap() {
  const [view, setView] = useState<View>("ownership");
  const baseline = useSimulatorStore((s) => s.baseline);
  const scenario = useSimulatorStore((s) => s.scenario);
  const governance = useSimulatorStore((s) => s.governance);
  const setScenario = useSimulatorStore((s) => s.setScenario);
  const setGovernance = useSimulatorStore((s) => s.setGovernance);

  const graph = useMemo(
    () => (view === "ownership" ? ownershipGraph(simulate(baseline, scenario)) : governanceGraph(governance)),
    [view, baseline, scenario, governance],
  );
  const layout = LAYOUTS[view];

  const dataFor = useMemo(
    () =>
      (node: MapNode): CardData => ({
        node,
        direction: layout.direction,
        onCycle: node.practice
          ? () => setGovernance({ [node.practice!]: NEXT_PRACTICE[governance[node.practice!]] })
          : undefined,
        transfer:
          node.id === "founder"
            ? { value: scenario.equityTransfer, onChange: (equityTransfer) => setScenario({ equityTransfer }) }
            : undefined,
      }),
    [layout.direction, governance, scenario.equityTransfer, setGovernance, setScenario],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CardData>>([]);

  // New view: lay it out afresh. Same view: refresh the figures, keep where the user dragged things.
  useEffect(() => {
    setNodes(
      graph.nodes.map((n) => ({ id: n.id, type: "card", position: layout.positions[n.id] ?? { x: 0, y: 0 }, data: dataFor(n) })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshing data must not reset positions
  }, [view]);
  useEffect(() => {
    setNodes((current) =>
      current.map((n) => {
        const fresh = graph.nodes.find((g) => g.id === n.id);
        return fresh ? { ...n, data: dataFor(fresh) } : n;
      }),
    );
  }, [graph, dataFor, setNodes]);

  const edges = useMemo(() => toEdges(graph, layout), [graph, layout]);
  const summary = graph.nodes.map((n) => `${n.title}: ${n.lines.join(", ")}`).join(". ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ownership &amp; governance map</CardTitle>
        <CardDescription>
          {view === "ownership"
            ? "Who holds what after the decision. Drag to rearrange; move the founder's transfer slider to watch value cascade."
            : "How authority flows from shareholders to management. Click a practice to change it; the score updates everywhere."}
        </CardDescription>
        <CardAction>
          <Segmented
            labelId="room-map-view"
            value={view}
            options={[
              { value: "ownership", label: "Ownership" },
              { value: "governance", label: "Governance" },
            ]}
            onChange={setView}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <span id="room-map-view" className="sr-only">
          Map view
        </span>
        <p className="sr-only">{summary}</p>
        <div className="h-[34rem] overflow-hidden rounded-lg border border-border">
          <ReactFlow
            key={view}
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            colorMode="dark"
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.4}
            maxZoom={1.75}
            nodesConnectable={false}
            style={{ background: "var(--background)" }}
          >
            <Background gap={24} size={1} color="var(--border)" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </CardContent>
    </Card>
  );
}
