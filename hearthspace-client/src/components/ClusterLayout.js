// ClusterLayout.jsx
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { createRoot } from 'react-dom/client';
import Avatar from '../components/Avatar'; // Your generic Avatar component
import { log as clLog, logError as clError } from '../utils/logger';

function ClusterLayout({ options = {}, nodes = [] }) {
  const containerRef = useRef(null);
  // Store the current nodes in a ref so we can update the simulation.
  const currentNodesRef = useRef([]);
  // Store the D3 simulation instance.
  const simulationRef = useRef(null);

  // Helper: get dimensions for selected vs. unselected nodes.
  function getSelectedDimensions() {
    const container = containerRef.current;
    const width = options.layoutOnViewport ? window.innerWidth : container.clientWidth;
    const baseSelWidth = Math.max(width * (options.selectedWidthPercent || 0.2), options.selectedMinWidth || 100);
    const adjustment = 0.75;
    const factor = 1; // You can add logic to vary this factor
    const selectedScale = Math.min(1, factor * adjustment);
    const selWidth = baseSelWidth * selectedScale;
    return { width: selWidth, height: selWidth * 0.75 };
  }

  function getUnselectedDimensions() {
    const factor = 1;
    const baseSize = 30;
    const computedWidth = (baseSize * factor) * 2;
    const computedHeight = (baseSize * factor) * 1.5;
    const maxWidth = 100;
    const maxHeight = 75;
    return {
      width: Math.min(computedWidth, maxWidth),
      height: Math.min(computedHeight, maxHeight)
    };
  }

  // Render (or update) the node elements using D3 data join.
  function renderNodes() {
    const container = containerRef.current;
    if (!container) return;

    const selection = d3
      .select(container)
      .selectAll('.cluster-node')
      .data(currentNodesRef.current, d => d.id);

    // Exit: unmount React components for nodes that are being removed.
    selection
      .exit()
      .each((d, i, nodes) => {
        const nodeEl = nodes[i];
        if (nodeEl._reactRoot) {
          nodeEl._reactRoot.unmount();
        }
      })
      .remove();

    // Enter: create new node containers.
    const enter = selection
      .enter()
      .append('div')
      .attr('class', 'cluster-node')
      .style('border-color', d => d.borderColor)
      .each((d, i, nodes) => {
        const nodeEl = nodes[i];
        const dims = d.isSelected ? getSelectedDimensions() : getUnselectedDimensions();
        nodeEl.style.width = dims.width + 'px';
        nodeEl.style.height = dims.height + 'px';
        nodeEl.style.transform = `translate(${d.x - dims.width / 2}px, ${d.y - dims.height / 2}px)`;
        clLog('🎨', 'ClusterLayout: Setting initial style for node', { id: d.id, dims, x: d.x, y: d.y });
        updateNodeContent(nodeEl, d, dims);
        nodeEl.addEventListener('click', () => toggleNode(d.id));
      });

    // Merge enter and update selections.
    enter.merge(selection).each((d, i, nodes) => {
      const nodeEl = nodes[i];
      const dims = d.isSelected ? getSelectedDimensions() : getUnselectedDimensions();
      nodeEl.style.width = dims.width + 'px';
      nodeEl.style.height = dims.height + 'px';
      nodeEl.style.transform = `translate(${d.x - dims.width / 2}px, ${d.y - dims.height / 2}px)`;
      updateNodeContent(nodeEl, d, dims);
    });
    clLog('🎨', 'ClusterLayout: renderNodes complete');
  }

  // Helper: mount or update the Avatar component in a node container.
  function updateNodeContent(nodeEl, d, dims) {
    const type =
      d.content && typeof d.content.getTracks === 'function'
        ? 'video'
        : 'initials';
    if (!nodeEl._reactRoot) {
      nodeEl._reactRoot = createRoot(nodeEl);
    }
    nodeEl._reactRoot.render(
      <Avatar
        stream={d.content}
        name={d.displayName}
	showControls={false}
        style={{ width: dims.width + 'px', height: dims.height + 'px' }}
      />
    );
  }

  // Update node positions based on simulation tick.
  function updatePositions() {
    if (!containerRef.current) return;
    d3.select(containerRef.current)
      .selectAll('.cluster-node')
      .style('transform', d => {
        const dims = d.isSelected ? getSelectedDimensions() : getUnselectedDimensions();
        return `translate(${d.x - dims.width / 2}px, ${d.y - dims.height / 2}px)`;
      });
  }

  // Toggle node selection state.
  function toggleNode(id) {
    const node = currentNodesRef.current.find(n => n.id === id);
    if (node) {
      node.isSelected = !node.isSelected;
      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0.6).restart();
      }
      renderNodes();
      clLog('🖱️', 'ClusterLayout: Toggled node', { id, isSelected: node.isSelected });
    }
  }

  // Initialize the simulation on mount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Set container dimensions.
    let width, height;
    if (options.layoutOnViewport) {
      width = window.innerWidth;
      height = window.innerHeight;
      container.style.position = 'absolute';
      container.style.top = '0';
      container.style.left = '0';
      container.style.width = '100vw';
      container.style.height = '100vh';
    } else {
      width = container.clientWidth;
      height = container.clientHeight;
      container.style.position = 'relative';
    }
    const centerX = width / 2;
    const centerY = height / 2;
    const movementSpeed = options.movementSpeed || 1;

    // Create the simulation.
    simulationRef.current = d3
      .forceSimulation(currentNodesRef.current)
      .force('x', d3.forceX(centerX).strength(0.15 * movementSpeed))
      .force('y', d3.forceY(centerY).strength(0.15 * movementSpeed))
      .force('charge', d3.forceManyBody().strength(-1 * movementSpeed))
      .force('collide', d3.forceCollide().radius(d => {
        const dims = d.isSelected ? getSelectedDimensions() : getUnselectedDimensions();
        return dims.width / 2 + 2;
      }).iterations(10))
      .alphaDecay(0.05)
      .on('tick', () => {
        updatePositions();
      });
    simulationRef.current.velocityDecay(0.9);

    clLog('🔧', 'ClusterLayout: Simulation initialized');
    // Cleanup on unmount.
    return () => {
      simulationRef.current.stop();
    };
    // We run this effect only once.
  }, []);

  // Update nodes when the prop changes.
  useEffect(() => {
    currentNodesRef.current = [...nodes];
    if (simulationRef.current) {
      simulationRef.current.nodes(currentNodesRef.current);
      simulationRef.current.alphaTarget(0.6).restart();
    }
    renderNodes();
    clLog('🤹‍♂️', 'ClusterLayout: Updated nodes', nodes);
  }, [nodes]);

  // Optionally, re-render on window resize.
  useEffect(() => {
    function handleResize() {
      const container = containerRef.current;
      if (!container) return;
      let width, height;
      if (options.layoutOnViewport) {
        width = window.innerWidth;
        height = window.innerHeight;
        container.style.width = '100vw';
        container.style.height = '100vh';
      } else {
        width = container.clientWidth;
        height = container.clientHeight;
      }
      clLog('🔄', 'ClusterLayout: New dimensions', { width, height });
      if (simulationRef.current) {
        simulationRef.current.force('x', d3.forceX(width / 2).strength(0.15 * (options.movementSpeed || 1)));
        simulationRef.current.force('y', d3.forceY(height / 2).strength(0.15 * (options.movementSpeed || 1)));
        simulationRef.current.alpha(0.6).restart();
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [options]);

  return <div ref={containerRef} id="clusterContainer" style={{ width: '100vw', height: '100vh' }} />;
}

export default ClusterLayout;
