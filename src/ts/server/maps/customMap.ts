import * as fs from 'fs';
import * as entities from '../../common/entities';
import { rect } from '../../common/rect';
import { TileType, MapType } from '../../common/interfaces';
import { createServerMap, deserializeMap } from '../serverMap';
import { World, goToMap } from '../world';
import { createSign, give } from '../controllerUtils';
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

	// special instant-respawn gift for testing at 20,15
	(function createInstantGift(x: number, y: number) {
		const ctor = entities.gift2;

		function spawn() {
			const ent = ctor(x, y) as ServerEntity;
			ent.interactRange = ent.interactRange || 1.5;
			ent.interact = (_entity: any, client: any) => {
				if (client.shadowed) {
					pushRemoveEntityToClient(client, _entity);
				} else {
					// remove current instance and respawn immediately at same coords
					world.removeEntity(_entity, map);
					const next = ctor(x, y) as ServerEntity;
					next.interactRange = next.interactRange || 1.5;
					next.interact = ent.interact; // preserve same behavior
					world.addEntity(next, map);
					// award gift to player
					pickGift(client);
				}
			};
			world.addEntity(ent, map);
		}

		spawn();
	})(20, 15);



	// sign with name 'test collectable objects' at 20.25,14
	// toggles between giving a basket and a jack-o-lantern on each click
	{
		const giveBasket = give(entities.basket.type);
		const giveLantern = give(entities.jackoLanternOn.type);
		let toggle = 0;
		add(createSign(20.25, 14, 'test collectable objects', (e, client) => {
			if ((toggle % 2) === 0) {
				giveBasket(e, client);
			} else {
				giveLantern(e, client);
			}
			toggle++;
		}, entities.sign));
	}

	// extra egg (egg-1-0) at 19.25,15
	(function createInstantEgg2(x: number, y: number) {
		const ctor = entities.eggs[0];

		function spawn() {
			const ent = ctor(x, y) as ServerEntity;
			ent.interactRange = ent.interactRange || 1.5;
			ent.interact = (_entity: any, client: any) => {
				if (client.shadowed) {
					pushRemoveEntityToClient(client, _entity);
				} else {
					world.removeEntity(_entity, map);
					const next = ctor(x, y) as ServerEntity;
					next.interactRange = next.interactRange || 1.5;
					next.interact = ent.interact;
					world.addEntity(next, map);
					pickEgg(client);
				}
			};
			world.addEntity(ent, map);
		}

		spawn();
	})(19.25, 15);

	// four-leaf-clover at 20.625,14.5
	(function createInstantClover2(x: number, y: number) {
		const ctor = entities.fourLeafClover;

		function spawn() {
			const ent = ctor(x, y) as ServerEntity;
			ent.interactRange = ent.interactRange || 1.5;
			ent.interact = (_entity: any, client: any) => {
				if (client.shadowed) {
					pushRemoveEntityToClient(client, _entity);
				} else {
					world.removeEntity(_entity, map);
					const next = ctor(x, y) as ServerEntity;
					next.interactRange = next.interactRange || 1.5;
					next.interact = ent.interact;
					world.addEntity(next, map);
					pickClover(client);
				}
			};
			world.addEntity(ent, map);
		}

		spawn();
	})(20.625, 14.5);

	// candy at 21.25,14.8
	(function createInstantCandy2(x: number, y: number) {
		const ctor = entities.candy;

		function spawn() {
			const ent = ctor(x, y) as ServerEntity;
			ent.interactRange = ent.interactRange || 1.5;
			ent.interact = (_entity: any, client: any) => {
				if (client.shadowed) {
					pushRemoveEntityToClient(client, _entity);
				} else {
					world.removeEntity(_entity, map);
					const next = ctor(x, y) as ServerEntity;
					next.interactRange = next.interactRange || 1.5;
					next.interact = ent.interact;
					world.addEntity(next, map);
					pickCandy(client);
				}
			};
			world.addEntity(ent, map);
		}

		spawn();
	})(21.25, 14.8);


	// place more entities here ...

	return map;
}
