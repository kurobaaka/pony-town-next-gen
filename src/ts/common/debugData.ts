import { MessageType } from './interfaces';

export const sampleMessages: { name: string; message: string; id?: number; type?: MessageType; }[] = [];

if (DEVELOPMENT) {
	sampleMessages.push(
		// System messages
		{ name: '', message: '/help - show help\n/roll [[min-]max] - randomize a number\n/s - say\n/p - party chat\n/t - thinking balloon', type: MessageType.System },
		{ name: '', message: 'The server will restart soon', type: MessageType.Announcement },

		// Admin and Mod messages
		{ name: 'Admin', message: 'Welcome to Pony Town! Please follow the rules.', type: MessageType.Admin },
		{ name: 'Moderator', message: 'Please keep the chat clean and respectful.', type: MessageType.Mod },

		// Party messages
		{ name: 'Player', message: 'Let\'s go on an adventure together!', type: MessageType.Party },
		{ name: 'Player', message: 'I think we should explore the cave.', type: MessageType.PartyThinking },
		{ name: 'Player', message: 'Party announcement: Meeting at the fountain!', type: MessageType.PartyAnnouncement },

		// Whisper messages
		{ name: 'Player', message: 'Hey, can I talk to you privately?', type: MessageType.Whisper, id: 1 },
		{ name: 'Player', message: 'Whisper announcement: Secret meeting tonight.', type: MessageType.WhisperAnnouncement },
		{ name: 'Player', message: 'To Player2: This is a private message.', type: MessageType.WhisperTo, id: 2 },
		{ name: 'Player', message: 'To Player2: Important announcement just for you.', type: MessageType.WhisperToAnnouncement, id: 2 },

		// Thinking messages
		{ name: 'Player', message: 'Hmm, what should I do next?', type: MessageType.Thinking },

		// Supporter messages
		{ name: 'Supporter1', message: 'Thanks for supporting Pony Town!', type: MessageType.Supporter1 },
		{ name: 'Supporter2', message: 'As a supporter, I love the new features.', type: MessageType.Supporter2, id: 1 },
		{ name: 'Supporter3', message: 'Supporters get exclusive perks!', type: MessageType.Supporter3, id: 2 },
		{ name: 'Supporter4', message: 'Pony Town is amazing with supporter status.', type: MessageType.Supporter4, id: 3 },

		// Dice roll
		{ name: 'Player', message: '🎲 rolled 42 of 100', type: MessageType.Announcement },

		// Long message for testing
		{ name: 'Player', message: 'This is a very long message to test how the chat handles wrapping and scrolling with lots of text that goes on and on without any particular purpose other than to fill space.', type: MessageType.Party },
	);
}
