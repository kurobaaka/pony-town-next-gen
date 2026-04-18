import { Router } from 'express';
import { GameStatus, ServerInfo, ServerInfoShort } from '../../common/interfaces';
import { InternalGameServerState, Settings, ServerLiveSettings } from '../../common/adminInterfaces';
import { createLoginServerStatus } from '../api/internal-login';
import { offline } from '../requestUtils';
import { servers } from '../internal';
import { version } from '../config';
import { isServerOffline } from '../serverUtils';
import { StatsTracker } from '../stats';
import { MIN_ADULT_AGE } from '../../common/constants';
import { CHANGELOG_PUBLIC, CHANGELOG_DEV } from '../../generated/changelog';
import { isAdmin, isDev, isMod } from '../../common/accountUtils';

function isServerSafe(server: InternalGameServerState) {
	return server.state.alert !== '18+';
}

function toServerState(server: InternalGameServerState): ServerInfo {
	const { name, path, desc, flag, alert, online, settings, require, host } = server.state;

	return {
		id: server.id,
		name,
		path,
		desc,
		host,
		flag,
		alert,
		dead: false,
		online,
		offline: isServerOffline(server),
		filter: !!settings.filterSwears,
		require,
	};
}

function toServerStateShort(server: InternalGameServerState): ServerInfoShort {
	return {
		id: server.id,
		online: server.state.online,
		offline: isServerOffline(server),
	};
}

function getGameStatus(
	servers: InternalGameServerState[], live: ServerLiveSettings, short: boolean, age: number
): GameStatus {
	const adult = age >= MIN_ADULT_AGE;

	return {
		version,
		update: live.updating ? true : undefined,
		servers: servers
			.filter(s => isServerSafe(s) || adult)
			.map(short ? toServerStateShort : toServerState),
	};
}

export default function (settings: Settings, live: ServerLiveSettings, statsTracker: StatsTracker) {
	const app = Router();

	app.get('/game/status', offline(settings), (req, res) => {
		const status = getGameStatus(servers, live, req.query.short === 'true', req.query.d | 0);
		res.json(status);
		statsTracker.logRequest(req, status);
	});

	app.get('/game/login-status', offline(settings), (_, res) => {
		res.json({ showTestingWarning: !!createLoginServerStatus(settings, live).showTestingWarning });
	});

	app.post('/csp', offline(settings), (_, res) => {
		//logger.warn('CSP report', getIPFromRequest(req), req.body['csp-report']);
		res.sendStatus(200);
	});

	app.get('/changelog', offline(settings), (req, res) => {
		const user = req.user as any;
		const isPrivileged = !!user && (isAdmin(user) || isMod(user) || isDev(user));

		res.json({
			public: CHANGELOG_PUBLIC,
			dev: isPrivileged ? CHANGELOG_DEV : [],
		});
	});

	return app;
}
