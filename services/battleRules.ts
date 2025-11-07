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