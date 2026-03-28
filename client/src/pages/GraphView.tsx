import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import * as d3 from "d3";
import {
  Network, ZoomIn, ZoomOut, Maximize2, RefreshCw,
  Building2, User, Globe, ChevronRight, Loader2, AlertTriangle, X
} from "lucide-react";

interface GraphNode {
  id: string;
  label: string;
  type: string;
  data?: Record<string, unknown>;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  label: string;
  data?: Record<string, unknown>;
}

const NODE_COLORS: Record<string, string> = {
  company: "oklch(0.65 0.18 210)",
  person: "oklch(0.65 0.18 280)",
  domain: "oklch(0.65 0.18 160)",
  organization: "oklch(0.65 0.18 50)",
  fund: "oklch(0.65 0.18 330)",
};

const NODE_ICONS: Record<string, React.ElementType> = {
  company: Building2,
  person: User,
  domain: Globe,
  organization: Building2,
  fund: Building2,
};

export default function GraphView() {
  const params = useParams<{ id: string }>();
  const entityId = parseInt(params.id || "0");
  const [, navigate] = useLocation();
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [depth, setDepth] = useState(2);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const fitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, refetch } = trpc.entity.getGraph.useQuery(
    { id: entityId, depth },
    { enabled: !!entityId }
  );

  const nodes = data?.nodes || [];
  const edges = data?.edges || [];

  const buildGraph = useCallback(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;

    // Container group for zoom
    const g = svg.append("g");
    gRef.current = g.node();

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    // Defs for markers and gradients
    const defs = svg.append("defs");

    // Arrow marker
    defs.append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "oklch(0.45 0.05 210)");

    // Glow filter
    const filter = defs.append("filter").attr("id", "glow");
    filter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Prepare simulation data
    const simNodes: GraphNode[] = nodes.map((n) => ({
      id: n.id,
      label: n.label,
      type: n.type,
      data: n.data as Record<string, unknown> | undefined,
    }));
    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

    const simEdges: GraphEdge[] = edges.map((e) => ({
      source: nodeMap.get(e.source) || e.source,
      target: nodeMap.get(e.target) || e.target,
      label: e.label,
      data: e.data as Record<string, unknown> | undefined,
    }));

    // Force simulation
    const simulation = d3.forceSimulation<GraphNode>(simNodes)
      .force("link", d3.forceLink<GraphNode, GraphEdge>(simEdges).id((d) => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(40));

    simulationRef.current = simulation;

    // Edge lines
    const link = g.append("g")
      .selectAll("line")
      .data(simEdges)
      .join("line")
      .attr("stroke", "oklch(0.35 0.04 210)")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.6)
      .attr("marker-end", "url(#arrowhead)");

    // Edge labels
    const edgeLabel = g.append("g")
      .selectAll("text")
      .data(simEdges)
      .join("text")
      .attr("font-size", "9px")
      .attr("fill", "oklch(0.5 0.05 210)")
      .attr("text-anchor", "middle")
      .text((d) => d.label.replace(/_/g, " "));

    // Node groups
    const node = g.append("g")
      .selectAll("g")
      .data(simNodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }) as any
      )
      .on("click", (event, d) => {
        event.stopPropagation();
        setSelectedNode(d);
      });

    // Node circles
    node.append("circle")
      .attr("r", (d) => d.id === String(entityId) ? 22 : 16)
      .attr("fill", (d) => `${NODE_COLORS[d.type] || NODE_COLORS.company}25`)
      .attr("stroke", (d) => NODE_COLORS[d.type] || NODE_COLORS.company)
      .attr("stroke-width", (d) => d.id === String(entityId) ? 2.5 : 1.5)
      .attr("filter", (d) => d.id === String(entityId) ? "url(#glow)" : "none");

    // Node type indicator dots
    node.append("circle")
      .attr("r", 4)
      .attr("cx", 10)
      .attr("cy", -10)
      .attr("fill", (d) => NODE_COLORS[d.type] || NODE_COLORS.company)
      .attr("opacity", 0.8);

    // Node labels
    node.append("text")
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .attr("font-size", (d) => d.id === String(entityId) ? "10px" : "8px")
      .attr("font-weight", (d) => d.id === String(entityId) ? "600" : "400")
      .attr("fill", "oklch(0.90 0.01 220)")
      .text((d) => d.label.length > 15 ? d.label.slice(0, 14) + "…" : d.label);

    // Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x || 0)
        .attr("y1", (d) => (d.source as GraphNode).y || 0)
        .attr("x2", (d) => (d.target as GraphNode).x || 0)
        .attr("y2", (d) => (d.target as GraphNode).y || 0);

      edgeLabel
        .attr("x", (d) => (((d.source as GraphNode).x || 0) + ((d.target as GraphNode).x || 0)) / 2)
        .attr("y", (d) => (((d.source as GraphNode).y || 0) + ((d.target as GraphNode).y || 0)) / 2);

      node.attr("transform", (d) => `translate(${d.x || 0},${d.y || 0})`);
    });

    // Click on background to deselect
    svg.on("click", () => setSelectedNode(null));

    // Auto-fit after stabilization
    if (fitTimeoutRef.current) clearTimeout(fitTimeoutRef.current);
    fitTimeoutRef.current = setTimeout(() => {
      const gNode = gRef.current;
      if (!svgRef.current || !gNode || !zoomRef.current) return;
      const bounds = gNode.getBBox();
      if (!bounds.width || !bounds.height) return;
      const fullWidth = svgRef.current.clientWidth || width;
      const fullHeight = svgRef.current.clientHeight || height;
      const midX = bounds.x + bounds.width / 2;
      const midY = bounds.y + bounds.height / 2;
      const scale = Math.min(0.9 * fullWidth / bounds.width, 0.9 * fullHeight / bounds.height, 1.5);
      const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];
      d3.select(svgRef.current).transition().duration(500).call(
        zoomRef.current.transform,
        d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
      );
    }, 1500);

  }, [nodes, edges, entityId]);

  useEffect(() => {
    buildGraph();
    return () => {
      simulationRef.current?.stop();
      if (fitTimeoutRef.current) clearTimeout(fitTimeoutRef.current);
    };
  }, [buildGraph]);

  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.3);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.77);
  }, []);

  const handleFit = useCallback(() => {
    if (!svgRef.current || !zoomRef.current || !gRef.current) return;
    const bounds = gRef.current.getBBox();
    if (!bounds.width || !bounds.height) return;
    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;
    const midX = bounds.x + bounds.width / 2;
    const midY = bounds.y + bounds.height / 2;
    const scale = Math.min(0.9 * width / bounds.width, 0.9 * height / bounds.height, 1.5);
    const tx = width / 2 - scale * midX;
    const ty = height / 2 - scale * midY;
    d3.select(svgRef.current)
      .transition()
      .duration(500)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }, []);

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-56px)]">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">Relationship Graph</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Depth:</span>
            {[1, 2, 3].map((d) => (
              <button
                key={d}
                onClick={() => setDepth(d)}
                className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                  depth === d ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}
              </button>
            ))}
            <div className="w-px h-5 bg-border mx-1" />
            <button
              onClick={handleZoomOut}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground text-xs transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomIn}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground text-xs transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              onClick={handleFit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Fit
            </button>
          </div>
        </div>

        {/* Graph area */}
        <div className="flex-1 relative overflow-hidden">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Building relationship graph...</p>
              </div>
            </div>
          ) : nodes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <AlertTriangle className="w-8 h-8 opacity-40" />
                <p>No relationships found for this entity</p>
                <button
                  onClick={() => navigate(`/entity/${entityId}`)}
                  className="text-primary text-sm hover:underline"
                >
                  View entity profile
                </button>
              </div>
            </div>
          ) : (
            <svg
              ref={svgRef}
              className="w-full h-full graph-container"
              style={{ background: "oklch(0.09 0.01 240)" }}
            />
          )}

          {/* Legend */}
          <div className="absolute bottom-4 left-4 intel-card rounded-lg p-3 text-xs space-y-1.5">
            <div className="font-medium text-foreground mb-2">Node Types</div>
            {Object.entries(NODE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                <span className="text-muted-foreground capitalize">{type}</span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="absolute top-4 left-4 intel-card rounded-lg px-3 py-2 text-xs flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5 text-primary" />
              <span className="text-foreground font-medium">{nodes.length}</span>
              <span className="text-muted-foreground">nodes</span>
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1.5">
              <span className="text-foreground font-medium">{edges.length}</span>
              <span className="text-muted-foreground">connections</span>
            </div>
          </div>

          {/* Selected node panel */}
          {selectedNode && (
            <div className="absolute top-4 right-4 w-64 intel-card rounded-xl p-4 intel-glow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `${NODE_COLORS[selectedNode.type] || NODE_COLORS.company}20`, border: `1px solid ${NODE_COLORS[selectedNode.type] || NODE_COLORS.company}40` }}
                  >
                    {(() => {
                      const Icon = NODE_ICONS[selectedNode.type] || Building2;
                      return <Icon className="w-4 h-4" style={{ color: NODE_COLORS[selectedNode.type] || NODE_COLORS.company }} />;
                    })()}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-sm">{selectedNode.label}</div>
                    <div className="text-xs text-muted-foreground capitalize">{selectedNode.type}</div>
                  </div>
                </div>
                <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selectedNode.data && (
                <div className="space-y-1.5 text-xs">
                  {Object.entries(selectedNode.data as Record<string, unknown>)
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-muted-foreground capitalize min-w-[70px]">{k}:</span>
                        <span className="text-foreground">{String(v)}</span>
                      </div>
                    ))}
                </div>
              )}

              <button
                onClick={() => navigate(`/entity/${selectedNode.id}`)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs hover:bg-primary/25 transition-colors"
              >
                <Network className="w-3.5 h-3.5" />
                View Full Profile
              </button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
