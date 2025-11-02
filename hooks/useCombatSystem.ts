import { useCallback, useEffect } from 'react';
import { CampaignState, CampaignActions } from './useCampaign';
import { Character, DiceRoll, RollRequest, InventoryItem, Spell, Monster, StructuredApiResponse, ToolCall } from '../types';
import { rollInitiative, rollDice } from '../utils'; // Pastikan rollDice di-impor
import { geminiService } from '../services/geminiService';

interface CombatSystemProps {
    campaign: CampaignState;
    character: Character;
    players: Character[];
    campaignActions: CampaignActions;
    updateCharacter: (character: Character) => Promise<void>;
}

export function useCombatSystem({ campaign, character, players, campaignActions, updateCharacter }: CombatSystemProps) {

    const processToolCalls = useCallback((turnId: string, toolCalls: ToolCall[]) => {
        toolCalls.forEach(call => {
            let message = '';
            switch (call.functionName) {
                case 'add_items_to_inventory':
                    campaignActions.addItemsToInventory(call.args);
                    message = `Inventaris diperbarui: ${call.args.items.map((i: any) => `${i.name} (x${i.quantity})`).join(', ')}`;
                    break;
                case 'update_quest_log':
                    campaignActions.updateQuestLog(call.args);
                    message = `Jurnal diperbarui: ${call.args.title}`;
                    break;
                case 'log_npc_interaction':
                    campaignActions.logNpcInteraction(call.args);
                    message = `Catatan NPC diperbarui: ${call.args.npcName}`;
                    break;
                // Tambahkan case untuk spawn_monsters jika tool call terjadi di tengah kombat
                case 'spawn_monsters':
                    campaignActions.spawnMonsters(call.args.monsters);
                    message = `Bahaya! Musuh baru muncul!`;
                    break;
            }
            if (message) {
                campaignActions.logEvent({ type: 'system', text: `--- ${message} ---` }, turnId);
            }
        });
    }, [campaignActions]);


    // =================================================================
    // LANGKAH 1: DEKLARASIKAN handleRollComplete SEBELUM processMechanics
    // =================================================================
    const handleRollComplete = useCallback(async (roll: DiceRoll, request: RollRequest, turnId: string) => {
        // const turnId = campaign.turnId; // <-- HAPUS BARIS INI
        if (!turnId) {
            console.error("Mencoba mencatat peristiwa tanpa turnId eksplisit.");
            return;
        }

        campaignActions.setActiveRollRequest(null);

        // Handle Death Save
        if (request.type === 'deathSave') {
            const newSaves = { ...character.deathSaves };
            let message = `${character.name} membuat lemparan penyelamatan kematian... `;
            if (roll.success) {
                newSaves.successes++;
                message += `dan berhasil! (Sukses: ${newSaves.successes}, Gagal: ${newSaves.failures})`;
            } else {
                newSaves.failures++;
                message += `dan gagal. (Sukses: ${newSaves.successes}, Gagal: ${newSaves.failures})`;
            }
            campaignActions.logEvent({ type: 'system', text: message }, turnId);

            const updatedChar = { ...character, deathSaves: newSaves };
            await updateCharacter(updatedChar);

            if (newSaves.successes >= 3) {
                campaignActions.logEvent({ type: 'system', text: `${character.name} telah stabil!` }, turnId);
            } else if (newSaves.failures >= 3) {
                campaignActions.logEvent({ type: 'system', text: `${character.name} telah tewas.` }, turnId);
            }

            campaignActions.endTurn();
            return;
        }

        let target: Monster | Character | undefined = [...campaign.monsters, ...players].find(c => c.id === request.target?.id);

        if (!target) {
            console.error("Target tidak ditemukan untuk penyelesaian lemparan");
            campaignActions.endTurn();
            return;
        }

        // --- STAGE: ATTACK ---
        if (request.stage === 'attack') {
            const successText = roll.success ? `mengenai (Total ${roll.total} vs AC ${target.armorClass})` : `gagal mengenai (Total ${roll.total} vs AC ${target.armorClass})`;
            const attackerName = 'ownerId' in target ? 'ownerId' in request ? character.name : campaign.monsters.find(m => m.id === request.characterId)?.name : character.name;
            const rollMessage = `${attackerName} menyerang ${target.name} dan ${successText}.`;

            campaignActions.logEvent({ type: 'system', text: rollMessage }, turnId);

            if (roll.success) {
                const damageRollRequest: RollRequest = {
                    type: 'damage', characterId: request.characterId, reason: `Menentukan kerusakan terhadap ${target.name}`,
                    target: { id: target.id, name: target.name, ac: target.armorClass },
                    stage: 'damage', damageDice: request.damageDice,
                };
                // Jika ini monster, auto-roll damage
                if (campaign.monsters.some(m => m.id === request.characterId)) {
                    const damageResult = rollDice(request.damageDice || '1d4');
                    const simulatedDamageRoll: DiceRoll = {
                        notation: request.damageDice || '1d4',
                        rolls: damageResult.rolls,
                        modifier: damageResult.modifier,
                        total: damageResult.total,
                        type: 'damage',
                    };
                    // PERBAIKAN STABILITAS: Tambahkan cek turnId di dalam timeout
                    setTimeout(() => {
                        // Cek apakah giliran MASIH VALID saat callback ini jalan
                        if (campaign.turnId === turnId) {
                            handleRollComplete(simulatedDamageRoll, damageRollRequest, turnId);
                        } else {
                            console.warn(`Timeout damage roll untuk turn ${turnId} dibatalkan karena giliran sudah berakhir.`);
                        }
                    }, 500);
                } else {
                    campaignActions.setActiveRollRequest(damageRollRequest);
                }
            } else {
                campaignActions.endTurn();
            }
            // --- STAGE: DAMAGE ---
        } else if (request.stage === 'damage') {
            const newHp = Math.max(0, target.currentHp - roll.total);
            const rollMessage = `${target.name} menerima ${roll.total} kerusakan! Sisa HP: ${newHp}.`;
            campaignActions.logEvent({ type: 'system', text: rollMessage }, turnId);

            if ('ownerId' in target) { // it's a Character
                const updatedTarget = { ...target, currentHp: newHp };
                await updateCharacter(updatedTarget);
            } else { // it's a Monster
                const updatedTarget = { ...target, currentHp: newHp };
                campaignActions.updateMonster(updatedTarget);
            }

            if (newHp === 0) {
                campaignActions.logEvent({ type: 'system', text: `${target.name} telah dikalahkan!` }, turnId);
                if (!('ownerId' in target)) {
                    campaignActions.removeMonster(target.id);
                }
                const remainingMonsters = campaign.monsters.filter(m => m.id !== target?.id && m.currentHp > 0);

                // =================================================================
                // LANGKAH 2: PUTUS LINGKARAN - REPLIKASI LOGIKA AKHIR KOMBAT
                // =================================================================
                if (remainingMonsters.length === 0) {
                    campaignActions.logEvent({ type: 'system', text: 'Semua musuh telah dikalahkan! Pertarungan berakhir.' }, turnId);
                    campaignActions.setGameState('exploration');
                    try {
                        const actionText = "Pertarungan telah berakhir. Apa yang terjadi selanjutnya?";
                        
                        // ==========================================================
                        // PERBAIKAN: Menggunakan alur 2 panggilan (Narasi -> Mekanik)
                        // ==========================================================
                        
                        // PANGGILAN 1: Dapatkan Narasi Akhir Kombat
                        const narrationResult = await geminiService.generateNarration(campaign, players, actionText, campaignActions.setThinkingState);
                        if (narrationResult.reaction) campaignActions.logEvent({ type: 'dm_reaction', text: narrationResult.reaction }, turnId);
                        if (narrationResult.narration) campaignActions.logEvent({ type: 'dm_narration', text: narrationResult.narration }, turnId);
                        
                        const contextNarration = narrationResult.narration || narrationResult.reaction || "Pertarungan berakhir.";

                        // PANGGILAN 2: Dapatkan Mekanik (loot, quest, dll)
                        const mechanicsResult = await geminiService.determineNextStep(
                            campaign, 
                            players, 
                            actionText, 
                            contextNarration, 
                            campaignActions.setThinkingState
                        );

                        if (mechanicsResult.tool_calls && mechanicsResult.tool_calls.length > 0) {
                            processToolCalls(turnId, mechanicsResult.tool_calls);
                        }
                        if (mechanicsResult.choices && mechanicsResult.choices.length > 0) {
                            campaignActions.setChoices(mechanicsResult.choices!);
                        }
                        // Kita asumsikan tidak ada roll request langsung setelah kombat berakhir
                        // Jika ada, tambahkan logikanya di sini.

                    } finally {
                        campaignActions.endTurn();
                    }
                    return;
                }
            }
            campaignActions.endTurn();
        } else {
            campaignActions.endTurn();
        }
        // =================================================================
        // LANGKAH 3: PERBARUI DEPENDENSI (HAPUS processMechanics)
        // =================================================================
    }, [campaign, character, players, campaignActions, updateCharacter, processToolCalls]);


    // =================================================================
    // LANGKAH 4: DEKLARASIKAN processMechanics (SEKARANG AMAN)
    // =================================================================
    const processMechanics = useCallback((turnId: string, mechanics: Omit<StructuredApiResponse, 'reaction' | 'narration'>, originalActionText: string) => {
        if (!turnId) {
            console.error("processMechanics dipanggil tanpa turnId aktif!");
            return; // Jangan proses jika tidak ada giliran
        }

        let turnShouldEnd = true; // Asumsikan giliran akan berakhir kecuali ada aksi pemain

        if (mechanics.tool_calls && mechanics.tool_calls.length > 0) {
            processToolCalls(turnId, mechanics.tool_calls);
        }

        const hasChoices = mechanics.choices && mechanics.choices.length > 0;
        const hasRollRequest = !!mechanics.rollRequest;
        const isMonsterTurn = campaign.monsters.some(m => m.id === campaign.currentPlayerId);

        if (hasChoices) {
            campaignActions.setChoices(mechanics.choices!);
            turnShouldEnd = false; // Ada pilihan untuk pemain, jangan akhiri giliran
        }

        if (hasRollRequest) {
            const request = mechanics.rollRequest!;
            const fullRollRequest: RollRequest = {
                ...request,
                characterId: isMonsterTurn ? campaign.currentPlayerId! : (campaign.currentPlayerId || character.id),
                originalActionText: originalActionText,
            };

            if (isMonsterTurn) {
                // --- Logika Auto-Roll Monster ---
                const monster = campaign.monsters.find(m => m.id === campaign.currentPlayerId)!;
                let rollNotation = '1d20';
                let modifier = 0;
                let dc = 10;
                let stage: 'attack' | 'damage' = 'attack';
                let damageDice = '1d4';

                if (request.type === 'attack') {
                    const targetPlayer = players.find(p => p.id === request.target?.id) || players.find(p => p.currentHp > 0) || players[0]; // Target pemain hidup pertama
                    if (!targetPlayer) {
                        console.warn(`Monster ${monster.name} tidak punya target pemain yang valid.`);
                        campaignActions.logEvent({ type: 'system', text: `${monster.name} tidak menemukan target.` }, turnId);
                        // Biarkan turnShouldEnd = true
                    } else {
                        const monsterAction = monster.actions.find(a => request.reason.toLowerCase().includes(a.name.toLowerCase())) || monster.actions[0];
                        modifier = monsterAction.toHitBonus;
                        dc = targetPlayer.armorClass;
                        stage = 'attack';
                        damageDice = monsterAction.damageDice;
                        fullRollRequest.stage = stage;
                        fullRollRequest.damageDice = damageDice;
                        fullRollRequest.target = { id: targetPlayer.id, name: targetPlayer.name, ac: dc };

                        const result = rollDice(rollNotation);
                        const total = result.total + modifier;
                        const success = total >= dc;
                        const simulatedRoll: DiceRoll = {
                            notation: rollNotation, rolls: result.rolls, modifier: modifier,
                            total: total, success: success, type: request.type,
                        };

                        // Jadwalkan penyelesaian roll
                        setTimeout(() => {
                            // Pastikan giliran masih valid saat timeout dieksekusi
                            if (campaign.turnId === turnId) {
                                handleRollComplete(simulatedRoll, fullRollRequest, turnId);
                            } else {
                                console.warn(`Timeout handleRollComplete untuk turn ${turnId} dibatalkan karena giliran sudah berakhir.`);
                            }
                        }, 500);
                        turnShouldEnd = false; // Giliran belum selesai, menunggu roll
                    }
                } else {
                    // Handle roll non-attack monster jika ada (misal saving throw)
                    console.warn(`Jenis roll monster ${request.type} belum diimplementasikan untuk auto-roll.`);
                    // Biarkan turnShouldEnd = true
                }
            } else {
                // --- Ini Roll Request untuk Pemain ---
                campaignActions.setActiveRollRequest(fullRollRequest);
                turnShouldEnd = false; // Giliran belum selesai, menunggu input pemain
            }
        }

        // --- Logika Akhir Giliran yang Baru ---
        if (turnShouldEnd) {
            // Hanya akhiri giliran jika tidak ada roll request aktif (untuk pemain)
            // atau jika itu giliran monster tapi tidak ada aksi valid yang bisa dilakukan
            if (!campaign.activeRollRequest || isMonsterTurn) {
                // Tambahkan sedikit delay jika ini akhir giliran monster,
                // agar narasi sempat tampil sebelum giliran berikutnya
                const delay = isMonsterTurn ? 500 : 0;
                setTimeout(() => {
                    // Cek lagi sebelum end turn
                    if (campaign.turnId === turnId) {
                        console.log(`Mengakhiri giliran ${turnId} dari processMechanics.`);
                        campaignActions.endTurn();
                    }
                }, delay);
            }
        }
        // Perbarui dependensi
    }, [campaign.currentPlayerId, character.id, campaign.monsters, players, campaignActions, processToolCalls, handleRollComplete, campaign.activeRollRequest, campaign.turnId]); // Tambahkan campaign.activeRollRequest dan campaign.turnId

    // Effect to start combat if it hasn't been started
    useEffect(() => {
        if (campaign.gameState === 'combat' && campaign.initiativeOrder.length === 0 && campaign.monsters.length > 0) {
            const turnId = campaignActions.startTurn();
            const combatants = [...players.filter(p => campaign.playerIds.includes(p.id)), ...campaign.monsters];
            const initiatives = combatants.map(c => ({
                id: c.id,
                initiative: rollInitiative('dexterity' in c ? c.dexterity : c.abilityScores.dexterity)
            }));
            initiatives.sort((a, b) => b.initiative - a.initiative);
            const order = initiatives.map(i => i.id);
            campaignActions.setInitiativeOrder(order);
            campaignActions.setCurrentPlayerId(order[0]);
            campaignActions.logEvent({ type: 'system', text: `Pertarungan dimulai! Urutan inisiatif telah ditentukan.` }, turnId);
            campaignActions.endTurn(); // End this setup turn
        }
    }, [campaign.gameState, campaign.initiativeOrder.length, campaign.monsters, players, campaignActions, campaign.playerIds]);


    // =================================================================
    // LANGKAH 5: PERBARUI DEPENDENSI advanceTurn
    // =================================================================
    const advanceTurn = useCallback(async () => {
        const { initiativeOrder, currentPlayerId, monsters } = campaign;
        if (initiativeOrder.length === 0 || campaign.turnId) return; // Don't advance if a turn is in progress

        const currentIndex = initiativeOrder.findIndex(id => id === currentPlayerId);
        const nextIndex = (currentIndex + 1) % initiativeOrder.length;
        const nextPlayerId = initiativeOrder[nextIndex];

        const turnId = campaignActions.startTurn();

        campaignActions.setCurrentPlayerId(nextPlayerId);

        const nextCombatant = [...players, ...monsters].find(c => c.id === nextPlayerId);

        if (nextCombatant) {
            campaignActions.logEvent({ type: 'system', text: `Sekarang giliran ${nextCombatant.name}.` }, turnId);

            if ('actions' in nextCombatant) { // It's a monster
                try {
                    const playerTargets = players.filter(p => p.currentHp > 0);
                    const target = playerTargets[Math.floor(Math.random() * playerTargets.length)];
                    if (target) {
                        const actionText = `${nextCombatant.name} menyerang ${target.name}.`;

                        // ==========================================================
                        // PERBAIKAN: Menggunakan alur 2 panggilan (Narasi -> Mekanik)
                        // ==========================================================

                        // PANGGILAN 1: Dapatkan Narasi Aksi Monster
                        const narrationResult = await geminiService.generateNarration(
                            campaign, 
                            players, 
                            actionText, 
                            campaignActions.setThinkingState
                        );

                        // Log narasi monster SEKARANG
                        if (narrationResult.reaction) campaignActions.logEvent({ type: 'dm_reaction', text: narrationResult.reaction }, turnId);
                        if (narrationResult.narration) campaignActions.logEvent({ type: 'dm_narration', text: narrationResult.narration }, turnId);
                        
                        // Buat konteks untuk panggilan kedua
                        const contextNarration = narrationResult.narration || narrationResult.reaction || "Monster itu bertindak.";

                        // PANGGILAN 2: Dapatkan Mekanik (yang akan di-auto-roll oleh processMechanics)
                        const mechanicsResult = await geminiService.determineNextStep(
                            campaign,
                            players,
                            actionText,
                            contextNarration,
                            campaignActions.setThinkingState
                        );
                        
                        // processMechanics akan menangani roll otomatis monster
                        processMechanics(turnId, mechanicsResult, actionText);
                        // ==========================================================

                    } else {
                        campaignActions.logEvent({ type: 'dm_narration', text: `${nextCombatant.name} tidak menemukan target.` }, turnId);
                        campaignActions.endTurn();
                    }
                } catch (e) {
                    console.error("AI Monster turn failed", e);
                    campaignActions.logEvent({ type: 'system', text: `${nextCombatant.name} ragu-ragu sejenak.` }, turnId);
                    campaignActions.endTurn();
                }
            } else { // It's a player's turn
                // PERBAIKAN KRITIS: HENTIKAN INFINITE LOOP
                // Giliran pemain sekarang tetap aktif (turnId tidak null) sampai mereka
                // mengambil aksi, yang kemudian akan memanggil endTurn() setelah selesai.
            }
        } else {
            campaignActions.endTurn();
        }

    }, [campaign, players, campaignActions, processMechanics]); // <-- Pastikan processMechanics ada di sini

    // This effect runs after a turn ends to advance to the next combatant
    useEffect(() => {
        if (campaign.gameState === 'combat' && !campaign.turnId) {
            advanceTurn();
        }
    }, [campaign.gameState, campaign.turnId, advanceTurn]);


    const handlePlayerAttack = useCallback((targetId: string, item: InventoryItem) => {
        // PERBAIKAN KRITIS: Logika aksi pemain diubah total
        // Cek BARU: Hanya izinkan jika giliran aktif DAN itu giliran kita
        if (character.currentHp <= 0 || !campaign.turnId || campaign.currentPlayerId !== character.id) {
            return;
        }

        const target = campaign.monsters.find(m => m.id === targetId);
        if (!target) return;

        const turnId = campaign.turnId;

        const attackRollRequest: RollRequest = {
            type: 'attack', characterId: character.id, reason: `Menyerang ${target.name} dengan ${item.name}`,
            target: { id: target.id, name: target.name, ac: target.armorClass },
            item, stage: 'attack', damageDice: item.damageDice,
        };
        campaignActions.logEvent({ type: 'player_action', characterId: character.id, text: `Menyerang ${target.name} dengan ${item.name}.` }, turnId);
        campaignActions.setActiveRollRequest(attackRollRequest);

    }, [campaign.monsters, campaign.turnId, campaign.currentPlayerId, character, campaignActions]); // Tambahkan campaign.currentPlayerId

    const handleItemUse = useCallback(async (item: InventoryItem) => {
        if (character.currentHp <= 0 || !campaign.turnId || campaign.currentPlayerId !== character.id) {
            return;
        }

        if (item.name.toLowerCase().includes('healing')) {
            const turnId = campaign.turnId;
            // Logika penyembuhan (bisa disederhanakan atau pakai rollDice)
            const healingResult = rollDice(item.effect?.dice || '2d4+2');
            const healing = healingResult.total;
            const newHp = Math.min(character.maxHp, character.currentHp + healing);
            const healedAmount = newHp - character.currentHp;

            campaignActions.logEvent({ type: 'system', text: `${character.name} menggunakan ${item.name} dan memulihkan ${healedAmount} HP (Total: ${healing}).` }, turnId);

            const updatedCharacter = {
                ...character,
                currentHp: newHp,
                inventory: character.inventory.map(i => i.name === item.name ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0)
            };
            await updateCharacter(updatedCharacter);
            campaignActions.endTurn(); // Menggunakan item mengakhiri giliran
        }
    }, [character, campaign.turnId, campaign.currentPlayerId, updateCharacter, campaignActions]); // Tambahkan campaign.currentPlayerId

    const handleSpellCast = useCallback((spell: Spell) => {
        // Cek BARU:
        if (character.currentHp <= 0 || !campaign.turnId || campaign.currentPlayerId !== character.id) {
            return;
        }
        const turnId = campaign.turnId;

        campaignActions.logEvent({ type: 'system', text: `${character.name} merapal ${spell.name}!` }, turnId);
        // TODO: Terapkan logika spell (roll, damage, heal) di sini
        campaignActions.endTurn(); // Merapal sihir mengakhiri giliran
    }, [character, campaign.turnId, campaign.currentPlayerId, campaignActions]); // Tambahkan campaign.currentPlayerId

    useEffect(() => {
        const isMyTurn = campaign.currentPlayerId === character.id;
        if (campaign.gameState === 'combat' && isMyTurn && !campaign.turnId && character.currentHp <= 0 && character.deathSaves.failures < 3 && character.deathSaves.successes < 3) {
            const turnId = campaignActions.startTurn();
            campaignActions.setActiveRollRequest({
                type: 'deathSave',
                characterId: character.id,
                reason: 'Membuat lemparan penyelamatan kematian untuk bertahan hidup.',
            });
        }
    }, [campaign.currentPlayerId, campaign.turnId, character.id, character.currentHp, character.deathSaves, campaign.gameState, campaignActions]);


    return {
        handlePlayerAttack,
        handleRollComplete,
        handleItemUse,
        handleSpellCast,
    };
}