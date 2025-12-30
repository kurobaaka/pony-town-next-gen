import { expect } from 'chai';
import * as sinon from 'sinon';
import { Account } from '../../server/db';
import { buildGiftsLeadersMessage } from '../../server/maps/mainMap';

describe('mainMap seasonal leaderboard', () => {
	afterEach(() => sinon.restore());

	it('builds leaderboard message with top 3 accounts', async () => {
		const fake = [
			{ _id: '1', name: 'Player 1', counters: { gifts: 200 } },
			{ _id: '2', name: 'Player 2', counters: { gifts: 150 } },
			{ _id: '3', name: 'Player 3', counters: { gifts: 100 } },
		];

		// Stub DB chain: Account.find(...).select(...).sort(...).limit(...).lean().exec()
		const exec = sinon.stub().resolves(fake as any);
		const lean = sinon.stub().returns({ exec });
		const limit = sinon.stub().returns({ lean });
		const sort = sinon.stub().returns({ limit });
		const select = sinon.stub().returns({ sort });
		const find = sinon.stub(Account, 'find').returns({ select } as any);

		const msg = await buildGiftsLeadersMessage();

		expect(msg).to.include('ТОП 3 ИГРОКОВ');
		expect(msg).to.include('Player 1');
		expect(msg).to.include('200');

		expect(find.calledOnce).true;
	});
});