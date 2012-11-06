function ChatSession(to, name, resource, conn, message) {
	this.adHoc = false;
	this.connection = conn;
	this.chatstates = function () {
		return this.connection.chatstates;
	}
	this.to = to;
	this.name = name;
	this.resource = resource;
	this.isGroupChat = false;
	this.messages = [];
	if (message) {
		this.messages.push(message);
	};
}

ChatSession.prototype = {
	sendMessage : function(message) {

		var fullMessage = this.chatstates().addActive(message).tree();

		this.connection.send(fullMessage);
		this.connection.flush();

		return fullMessage;
	},

	recvMessage : function(message) {
		this.messages.push(message);
		return message;
	},

	endChat : function() {
		this.chatstates().sendGone(to);
	}
};

Strophe.addConnectionPlugin('chat', (function() {
	// these are all local variables
	var _connection, _roster, _muc, _chatSessions;

	var init = function(connection) {
		Strophe.debug("init chat plugin");

		_connection = connection;
		_chatSessions = {};
		_roster = {};
		_muc = {};
		_connection.addHandler(this.incomingMessage.bind(this), null, "message");
	};

	// called when connection status is changed
	var statusChanged = function(status) {
		if (status === Strophe.Status.CONNECTED) {
			_roster = _connection.roster;
			_muc = _connection.muc;
			_chatSessions = {};
		}
	};

	var chatTo = function(to) {
		var bareJid = Strophe.getBareJidFromJid(to);
		var contact = _roster.findContact(bareJid);
		var chatSession = {};
		var resource = null;

		if (contact) {
			for (var res in contact.resources) {
				resource = res;
				break;
			}
			chatSession = new ChatSession(contact.jid, contact.name, resource, _connection);

			//_connection.addHandler(incomingMessage.bind(chatSession), null, "message", null, bareJid, {
			//	'matchBare' : true
			//});

			Strophe.info("Start chat with: " + Strophe.getBareJidFromJid(to));
			_chatSessions[bareJid] = chatSession;
			$(document).trigger('start_chatting', chatSession);
		}
		return true;
	};

	var joinRoomChat = function(jid) {
		var room = _muc.getRoom(jid);
		var chatSession = new ChatSession(room.roomJid, room.roomName, null, _connection);

		chatSession.isGroupChat = true;
		Strophe.info("Start room chat: " + room.roomJid);
		_chatSessions[room.roomJid] = chatSession;
		$(document).trigger('start_chatting', chatSession);

		return true;
	};

	var sendNewMessage = function(jid, resource, body, groupChat) {
		var message = {};
		var chatSession = {};
		var fullJid = jid;

		if (groupChat) {
			message = $msg({
				to : jid,
				"type" : "groupchat"
			}).c('body').t(body).up();
		} else {
			if (resource) {
				fullJid = jid + '/' + resource;
			}
			message = $msg({
				to : fullJid,
				"type" : "chat"
			}).c('body').t(body).up();
		}
		// Find the ChatSession
		chatSession = _chatSessions[jid] || null;
		if (chatSession) {
			Strophe.info("New chat message sent to: " + jid);

			message = chatSession.sendMessage(message);
			if (chatSession.isGroupChat === false) {
				$(document).trigger('new_chat_message', {
					'message' : message,
					'fromMe' : true
				});
			}
		}
	};

	var incomingMessage = function(message) {
		var msg = $(message);
		var from = msg.attr("from");
		var chatSession = _chatSessions[jid] || null;
		var type = msg.attr("type");
		var jid;
		var contact;
		var contactName;
		var room;

		if (type === "groupchat") {
			room = _muc.getRoom(from);
			if (room == null) {
				return true;
			}
		} else {
			if (chatSession) {
				// incomming message from existing session
				chatSession.recvMessage(msg);
			} else {
				// start new session with incomming message from contact
				Strophe.info("Start chat requested by: " + Strophe.getBareJidFromJid(from));
				// TODO Is this from a room
				room = null;
				//_connection.muc.isRoom(from);
				if (room) {
					contactName = Strophe.getResourceFromJid(from);
					jid = from;
				} else {
					jid = Strophe.getBareJidFromJid(from);
					// Is this someone in my roster
					contact = _roster.findContact(jid);
					if (contact) {
						contactName = contact.name;
					} else {
						contactName = Strophe.getNodeFromJid(from)
					}
				}
				chatSession = new ChatSession(jid, contactName, Strophe.getResourceFromJid(from), _connection, msg);
				_chatSessions[jid] = chatSession;

				$(document).trigger('start_chatting', chatSession);
			}
		}
		$(document).trigger('new_chat_message', {
			'message' : msg,
			'fromMe' : false,
			'type' : type
		});
		return true;
	};

	return {
		init : init,
		statusChanged : statusChanged,
		chatTo : chatTo,
		joinRoomChat : joinRoomChat,
		sendNewMessage : sendNewMessage,
		incomingMessage : incomingMessage,
	};
})());
