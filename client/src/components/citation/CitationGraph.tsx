// client/src/components/citation/CitationGraph.tsx
//
// d3-force 기반 인용 네트워크 시각화.
//
// • 시드(검정 테두리) + OA 가능(초록) + Partial(주황) + Paid(회색)
// • 사용자가 다운로드한 이력이 있는 노드는 보라색 테두리
// • 마우스 호버 시 인접 노드만 강조, 나머지 흐리게
// • 드래그로 위치 고정, 휠로 줌, 더블클릭으로 줌 리셋

import { useEffect, useRef } from 'react';
import { select } from 'd3-selection';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force';
import { drag } from 'd3-drag';
import { zoom, zoomIdentity } from 'd3-zoom';
import type { GraphNode, GraphEdge, GraphData } from '../../types/citation';

interface Props {
  data: GraphData;
  onNodeClick: (node: GraphNode) => void;
  highlightSeed?: boolean;
}

// 노드 모양 (accessStatus별)
function getNodeShape(d: GraphNode, baseSize: number): string {
  switch (d.accessStatus) {
    case 'downloadable':
      // 원
      return `M${-baseSize},0 A${baseSize},${baseSize} 0 1,0 ${baseSize},0 A${baseSize},${baseSize} 0 1,0 ${-baseSize},0`;
    case 'partial':
      // 다이아몬드
      return `M0,${-baseSize} L${baseSize},0 L0,${baseSize} L${-baseSize},0 Z`;
    case 'paid_only':
      // 사각형
      return `M${-baseSize},${-baseSize} h${baseSize * 2} v${baseSize * 2} h${-baseSize * 2} z`;
    default:
      // 육각형 (unknown)
      const r = baseSize;
      const pts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        pts.push(`${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`);
      }
      return `M${pts.join('L')}Z`;
  }
}

function getNodeColor(d: GraphNode): string {
  switch (d.accessStatus) {
    case 'downloadable': return '#10b981';  // 초록 — OA 다운로드 가능
    case 'partial': return '#f59e0b';        // 주황 — Preprint 가능
    case 'paid_only': return '#4b5563';      // 진한 회색 — 유료 (표시만, 다운로드는 출판사 페이지로)
    default: return '#9ca3af';              // 밝은 회색 — 상태 불명
  }
}

function getNodeSize(d: GraphNode): number {
  // 인용 수에 비례 (최소 6, 최대 30)
  return Math.max(6, Math.min(30, 6 + Math.sqrt(d.citationCount) * 0.5));
}

export default function CitationGraph({ data, onNodeClick, highlightSeed = true }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<any>(null);
  const zoomBehaviorRef = useRef<any>(null);

  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return;

    const svg = select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // ─── 1) 시뮬레이션 설정 ───────────────────────────────
    const simulation = forceSimulation(data.nodes as any)
      .force(
        'link',
        forceLink(data.edges)
          .id((d: any) => d.id)
          .distance(80)
          .strength(0.6)
      )
      .force('charge', forceManyBody().strength(-250))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide().radius(24))
      .alphaDecay(0.04)
      .velocityDecay(0.4);
    simulationRef.current = simulation;

    // ─── 2) 줌/팬 설정 ──────────────────────────────────
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 8])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });
    svg.call(zoomBehavior);
    zoomBehaviorRef.current = zoomBehavior;
    svg.on('dblclick.zoom', () => {
      // 즉시 줌 리셋 (부드러운 전환은 d3-transition 타입 추가 필요 — 후속 작업)
      svg.call(zoomBehavior.transform, zoomIdentity);
    });

    // ─── 3) 컨테이너 ────────────────────────────────────
    const container = svg.append('g').attr('class', 'graph-container');

    // ─── 4) 엣지 ────────────────────────────────────────
    const link = container
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(data.edges)
      .join('line')
      .attr('stroke', (d: any) => (d.type === 'cites' ? '#3b82f6' : '#10b981'))
      .attr('stroke-width', 1.2)
      .attr('stroke-opacity', 0.6)
      .attr('stroke-dasharray', (d: any) => (d.type === 'cited_by' ? '4 3' : null));

    // ─── 5) 노드 ────────────────────────────────────────
    const nodeGroup = container
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(data.nodes, (d: any) => d.id)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer');

    nodeGroup.call(
      drag<SVGGElement, GraphNode>()
        .on('start', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    );

    // 노드 모양
    nodeGroup
      .append('path')
      .attr('d', (d) => getNodeShape(d, getNodeSize(d)))
      .attr('fill', (d) => getNodeColor(d))
      .attr('stroke', (d) => {
        if (highlightSeed && d.isSeed) return '#000000';
        if (d.inCollection) return '#8b5cf6';
        return '#ffffff';
      })
      .attr('stroke-width', (d) => {
        if (highlightSeed && d.isSeed) return 3;
        if (d.inCollection) return 2.5;
        return 1.5;
      })
      .attr('opacity', 0.92);

    // 노드 호버 영역 (투명 큰 원)
    nodeGroup
      .append('circle')
      .attr('r', (d) => getNodeSize(d) + 6)
      .attr('fill', 'transparent');

    // 라벨
    nodeGroup
      .append('text')
      .text((d) => (d.title.length > 28 ? d.title.slice(0, 28) + '…' : d.title))
      .attr('font-size', 10)
      .attr('dx', 14)
      .attr('dy', 4)
      .style('pointer-events', 'none')
      .style('user-select', 'none')
      .attr('fill', '#374151')
      .style('font-family', 'system-ui, -apple-system, sans-serif');

    // ─── 6) 인터랙션 ────────────────────────────────────
    nodeGroup
      .on('click', (_event, d) => {
        onNodeClick(d);
      })
      .on('mouseenter', function (_event, d: any) {
        const neighbors = new Set<string>([d.id]);
        data.edges.forEach((e: any) => {
          const sId = typeof e.source === 'string' ? e.source : e.source.id;
          const tId = typeof e.target === 'string' ? e.target : e.target.id;
          if (sId === d.id) neighbors.add(tId);
          if (tId === d.id) neighbors.add(sId);
        });
        nodeGroup.style('opacity', (n: any) => (neighbors.has(n.id) ? 1 : 0.18));
        link.style('opacity', (l: any) => {
          const sId = typeof l.source === 'string' ? l.source : l.source.id;
          const tId = typeof l.target === 'string' ? l.target : l.target.id;
          return sId === d.id || tId === d.id ? 1 : 0.05;
        });
      })
      .on('mouseleave', () => {
        nodeGroup.style('opacity', 1);
        link.style('opacity', 0.6);
      });

    // ─── 7) tick ────────────────────────────────────────
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);
      nodeGroup.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // ─── 8) 클린업 ──────────────────────────────────────
    return () => {
      simulation.stop();
      svg.selectAll('*').remove();
      svg.on('.zoom', null);
    };
  }, [data, highlightSeed, onNodeClick]);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full bg-white dark:bg-gray-900"
      role="img"
      aria-label={`인용 네트워크 그래프 — ${data.nodes.length}개 노드, ${data.edges.length}개 엣지`}
    />
  );
}
