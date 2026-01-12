import * as fs from 'fs';
import * as entities from '../../common/entities';
import { rect } from '../../common/rect';
import { TileType, MapType } from '../../common/interfaces';
import { createServerMap, deserializeMap } from '../serverMap';
import { World, goToMap } from '../world';
import { createSign, createSignWithText } from '../controllerUtils';
import { saySystem } from '../chat';
import { ServerEntity } from '../serverInterfaces';
import { pathTo } from '../paths';
import { pickGift, pickCandy, pickEgg, pickClover } from '../mapUtils';
import { pushRemoveEntityToClient } from '../entityUtils';

// To customize the map use in-game editor tools to change tiles, then use `/savemap custom` command,
// your map will be saved to `/store/custom.json` file, move the file to `/src/maps/custom.json`
// and restart the server.
const mapData = JSON.parse(fs.readFileSync(pathTo('src', 'maps', 'custom.json'), 'utf8'));

export function createCustomMap(world: World) {
	// size: 4 by 4 regions -> 32 by 32 tiles
	// default tiles: grass
	const map = createServerMap('custom', MapType.None, 4, 4, TileType.Grass);

	// initialize tiles
	deserializeMap(map, mapData);

	// place default spawn point at the center of the map
	map.spawnArea = rect(map.width / 2, map.height / 2, 0, 0);

	// shorthand for adding entities
	function add(entity: ServerEntity) {
		world.addEntity(entity, map);
	}

	// place return sign 2 tiles north of center of the map
	add(createSign(map.width / 2, map.height / 2 - 2, 'Go back', (_, client) => goToMap(world, client, '', 'center')));

	// place barrel at 5, 5 location
	add(entities.barrel(5, 5));

	// helper: create an instant-respawn collectable with unified behaviour
	function createInstantCollectable(x: number, y: number, ctor: any, onCollect: (client: any) => void, range = 1.5, respawnDelay = 50) {
		function spawn() {
			const ent = ctor(x, y) as ServerEntity;
			ent.interactRange = ent.interactRange || range;

			const handleInteract = (_entity: any, client: any) => {
				if (client.shadowed) {
					// invisible player: don't award, just remove on their client
					pushRemoveEntityToClient(client, _entity);
					return;
				}

				// remove current instance so player sees it disappear
				world.removeEntity(_entity, map);

				// award immediately (hold item, counters, messages)
				onCollect(client);

				// respawn a visible instance shortly after so player notices the pickup
				setTimeout(() => {
					const next = ctor(x, y) as ServerEntity;
					next.interactRange = next.interactRange || range;
					next.interact = handleInteract; // reuse same handler
					world.addEntity(next, map);
				}, respawnDelay);
			};

			ent.interact = handleInteract;
			world.addEntity(ent, map);
		}

		spawn();
	}

	// special instant-respawn gift for testing at 20,15 (uses unified helper)
	createInstantCollectable(20, 15, entities.gift2, (c) => pickGift(c));



	// sign with name 'test collectable objects' at 20.25,14
	// show milestones list instead of awarding items; message should be from the sign itself
	add(createSignWithText(20.25, 14, 'test collectable objects', 'Милестоны:\nПодарки: каждые 100\nЯйца: каждые 50\nКлеверы: каждые 25\nКонфеты: каждые 75', entities.sign));

	// extra egg (egg-1-0) at 19.25,15
	createInstantCollectable(19.25, 15, entities.eggs[0], (c) => pickEgg(c));

	// four-leaf-clover at 20.625,14.5
	createInstantCollectable(20.625, 14.5, entities.fourLeafClover, (c) => pickClover(c));

	// candy at 21.25,14.8
	createInstantCollectable(21.25, 14.8, entities.candy, (c) => pickCandy(c));


	// place more entities here ...

	return map;
}
