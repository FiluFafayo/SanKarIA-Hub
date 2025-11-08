<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1yTBiyoyfLCynWFMWLrovfzkbLaXrHHt7

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Dependency Health

- Install dev tools: `npm install -D madge`
- Check for circular dependencies: `npm run dep:check`
- Generate dependency graph image: `npm run dep:graph`

## Dependency Injection (Repositories)

- Access repositories via `getRepositories()` instead of importing singletons directly.
- Override repositories in tests or special flows using `setRepositories`.

Example (mocking in tests):

```
import { setRepositories, getRepositories } from './services/repository';

// Provide a mock for campaign repository
setRepositories({
  ...getRepositories(),
  campaign: {
    getPublishedCampaigns: async () => [{ id: 'c1', title: 'Mock Campaign', ownerId: 'u1', playerIds: [], eventLog: [], monsters: [], players: [], description: '', image: '', joinCode: 'MOCK', isPublished: true, maxPlayers: 4, theme: '', mainGenre: '', subGenre: '', duration: '', isNSFW: false, dmPersonality: '', dmNarrationStyle: 'Deskriptif', responseLength: 'Standar', gameState: 'exploration', currentPlayerId: null, initiativeOrder: [], longTermMemory: '', currentTime: 0, currentWeather: 'Cerah', worldEventCounter: 0, mapImageUrl: undefined, mapMarkers: [], explorationGrid: {}, fogOfWar: {}, battleState: {}, playerGridPosition: {}, currentPlayerLocation: undefined, quests: [], npcs: [] }],
    getMyCampaigns: async () => [],
    getCampaignByJoinCode: async () => null,
    createCampaign: async () => { throw new Error('not implemented in mock'); },
    saveCampaign: async (c) => c,
    addPlayerToCampaign: async () => {},
    logGameEvent: async () => {},
  }
});

// Usage in code
const { campaign } = getRepositories();
const published = await campaign.getPublishedCampaigns();
```

## Lint Guards (Stage 6)

- Run lint checks: `npm run lint`
- Rules enforced:
  - `import/no-cycle`: prevents circular imports.
  - `no-restricted-imports` in `components/**` and `store/**`: blocks direct imports of `services/dataService` (must go via `services/repository`).
