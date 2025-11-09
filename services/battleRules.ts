// services/battleRules.ts
// Ditransplantasi dari P2 (ai-native-virtual-tabletop-architect)
// Menggantikan P2 'rulesEngine.ts'.

import { Unit, BattleState, TerrainType, GridCell } from '../types';

// Standar biaya pergerakan D&D 5e
export const MOVEMENT_COST = {
  Plains: 1,
  Difficult: 2,
  Obstacle: Infinity,
};

interface QueueNode {
  pos: { x: number; y: number };
  cost: number;
}

/**
 * Calculates all reachable grid cells for a given unit based on its movement speed.
 * Uses a Breadth-First Search (BFS) algorithm to explore the grid.
 * @param unit The unit that is moving.
 * @param battleState The current state of the battle, containing the grid and other units.
 * @returns A Set of reachable cell coordinates as strings "x,y".
 */
export const calculateMovementOptions = (
  unit: Unit,
  battleState: BattleState
): Set<string> => {
  const { gridMap, units } = battleState;
  const startPos = unit.gridPosition;
  const movementLimit = unit.remainingMovement;

  const reachableCells = new Set<string>();
  const visitedCosts: { [key: string]: number } = {};
  const queue: QueueNode[] = [{ pos: startPos, cost: 0 }];

  visitedCosts[`${startPos.x},${startPos.y}`] = 0;
  reachableCells.add(`${startPos.x},${startPos.y}`);

  const otherUnitPositions = new Set(units.filter(u => u.id !== unit.id).map(u => `${u.gridPosition.x},${u.gridPosition.y}`));

  while (queue.length > 0) {
    const { pos, cost } = queue.shift()!;

    // Explore neighbors (up, down, left, right)
    const neighbors = [
      { x: pos.x, y: pos.y - 1 },
      { x: pos.x, y: pos.y + 1 },
      { x: pos.x - 1, y: pos.y },
      { x: pos.x + 1, y: pos.y },
    ];

    for (const neighbor of neighbors) {
      const { x, y } = neighbor;
      const key = `${x},${y}`;

      // Check bounds
      if (x < 0 || x >= gridMap[0].length || y < 0 || y >= gridMap.length) {
        continue;
      }

      // Check for other units (can't move through)
      if (otherUnitPositions.has(key)) {
        continue;
      }

      const cell: GridCell = gridMap[y][x];
      let moveCost = 0;
      switch (cell.terrain) {
        case TerrainType.Plains:
          moveCost = MOVEMENT_COST.Plains;
          break;
        case TerrainType.Difficult:
          moveCost = MOVEMENT_COST.Difficult;
          break;
        case TerrainType.Obstacle:
          moveCost = MOVEMENT_COST.Obstacle;
          break;
      }

      if (moveCost === Infinity) continue;

      const newCost = cost + moveCost;

      if (newCost <= movementLimit) {
        if (!visitedCosts[key] || newCost < visitedCosts[key]) {
          visitedCosts[key] = newCost;
          reachableCells.add(key);
          queue.push({ pos: neighbor, cost: newCost });
        }
      }
    }
  }

  return reachableCells;
};

/**
 * Find the lowest-cost path from a unit's current position to a target cell.
 * Uses a simple Dijkstra over the grid with 4-directional movement.
 * Returns both the total cost and the path (including start and end).
 */
export const findShortestPath = (
  unit: Unit,
  battleState: BattleState,
  target: { x: number; y: number }
): { cost: number; path: { x: number; y: number }[] } | null => {
  const { gridMap, units } = battleState;
  const start = unit.gridPosition;

  const otherUnitPositions = new Set(
    units.filter((u) => u.id !== unit.id).map((u) => `${u.gridPosition.x},${u.gridPosition.y}`)
  );

  const width = gridMap[0].length;
  const height = gridMap.length;

  const key = (x: number, y: number) => `${x},${y}`;
  const getMoveCost = (x: number, y: number) => {
    const cell: GridCell = gridMap[y][x];
    switch (cell.terrain) {
      case TerrainType.Plains:
        return MOVEMENT_COST.Plains;
      case TerrainType.Difficult:
        return MOVEMENT_COST.Difficult;
      case TerrainType.Obstacle:
        return MOVEMENT_COST.Obstacle;
      default:
        return MOVEMENT_COST.Plains;
    }
  };

  const dist: Record<string, number> = {};
  const prev: Record<string, { x: number; y: number } | null> = {};
  const visited: Set<string> = new Set();
  const queue: { x: number; y: number; cost: number }[] = [];

  const startKey = key(start.x, start.y);
  dist[startKey] = 0;
  prev[startKey] = null;
  queue.push({ x: start.x, y: start.y, cost: 0 });

  const popMin = () => {
    let minIdx = -1;
    let minCost = Infinity;
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].cost < minCost) {
        minCost = queue[i].cost;
        minIdx = i;
      }
    }
    if (minIdx === -1) return null;
    const node = queue[minIdx];
    queue.splice(minIdx, 1);
    return node;
  };

  while (true) {
    const current = popMin();
    if (!current) break;
    const ck = key(current.x, current.y);
    if (visited.has(ck)) continue;
    visited.add(ck);

    if (current.x === target.x && current.y === target.y) {
      // Reconstruct path
      const path: { x: number; y: number }[] = [];
      let pk: string | null = key(target.x, target.y);
      while (pk) {
        const p = prev[pk];
        const [px, py] = pk.split(',').map((n) => parseInt(n, 10));
        path.push({ x: px, y: py });
        pk = p ? key(p.x, p.y) : null;
      }
      path.reverse();
      return { cost: current.cost, path };
    }

    const neighbors = [
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
    ];

    for (const n of neighbors) {
      if (n.x < 0 || n.x >= width || n.y < 0 || n.y >= height) continue;
      const nk = key(n.x, n.y);
      if (otherUnitPositions.has(nk)) continue; // cannot move through other units

      const moveCost = getMoveCost(n.x, n.y);
      if (moveCost === Infinity) continue; // impassable

      const alt = current.cost + moveCost;
      if (!(nk in dist) || alt < dist[nk]) {
        dist[nk] = alt;
        prev[nk] = { x: current.x, y: current.y };
        queue.push({ x: n.x, y: n.y, cost: alt });
      }
    }
  }

  return null; // unreachable
};