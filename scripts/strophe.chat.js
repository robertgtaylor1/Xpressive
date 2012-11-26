function Message(message, timestamp)
{
	this.message = message;
	this.timestamp = timestamp || new Date();
}

function ChatSession(chatWith, name, resource, conn, message) {
	this.adHoc = false;
	this.connection = conn;
	this.chatstates = function () {
		return this.connection.chatstates;
	}
	this.chatWith = chatWith;
	this.name = name;
	this.resource = resource;
	this.isGroupChat = false;
	this.messages = [];
	if (message) {
		this.messages.push(new Message(message));
	};
}

ChatSession.prototype = { 
	sendTopic : function(message){
		var fullMessage = message.tree();

		this.connection.send(fullMessage);
		this.connection.flush();

		return fullMessage;		
	},

	sendMessage : function(message, timestamp) {

		var fullMessage = this.chatstates().addActive(message).tree();

		this.connection.send(fullMessage);
		this.connection.flush();
		if (this.isGroupChat === false) {
			this.messages.push(new Message(message, timestamp));
		}
		return fullMessage;
	},

	recvMessage : function(message, timestamp) {
		this.messages.push(new Message(message, timestamp));
		return message;
	},

	// called by endSession
	endChat : function() {
		if (this.isGroupChat){
			this.connection.muc.leave(this.chatWith.jid);
		} else {			
			this.chatstates().sendGone(this.chatWith.jid);
		}
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
		_connection.addHandler(this.incomingMessage.bind(this), null, "message"); //, null, null, null, { isDefault : true });
	};

	// called when connection status is changed
	var statusChanged = function(status) {
		if (status === Strophe.Status.CONNECTED) {
			_roster = _connection.roster;
			_muc = _connection.muc;
			_chatSessions = {};
		}
	};
	
	var chatTo = function(contact) {
		var chatSession = {};
		var resource = null;

		if (contact) {
			for (var res in contact.resources) {
				resource = res;
				break;
			}
			chatSession = new ChatSession(contact, contact.name, resource, _connection);

			//_connection.addHandler(incomingMessage.bind(chatSession), null, "message", null, bareJid, {
			//	'matchBare' : true
			//});

			Strophe.info("Start chat with: " + contact.name + "(" +contact.jid + ")");
			_chatSessions[contact.jid] = chatSession;
			$(document).trigger('start_chatting', chatSession);
		}
		return chatSession;
	};

	var joinRoomChat = function(room) {
		var chatSession = new ChatSession(room, room.roomName, null, _connection);

		chatSession.isGroupChat = true;
		Strophe.info("Start room chat: " + room.jid);
		_chatSessions[room.jid] = chatSession;
		$(document).trigger('start_chatting', chatSession);

		return chatSession;
	};

	var sendNewTopic = function(jid, topic) {
		var message = $msg({
				to : jid,
				"type" : "groupchat"
			}).c('subject').t(topic).up();

		// Find the ChatSession
		var chatSession = _chatSessions[jid] || null;
		if (chatSession) {
			Strophe.info("Topic change sent to: " + jid);

			message = chatSession.sendTopic(message);
		}
	}

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
			
			var msgTimestamp = new Date();
			message = chatSession.sendMessage(message, msgTimestamp);
			if (chatSession.isGroupChat === false) {
				$(document).trigger('new_chat_message', {
					'message' : message,
					'timestamp' : msgTimestamp,
					'fromMe' : true
				});
			}
		}
	};

	var incomingMessage = function(message) {
		var msg = $(message);
		var from = msg.attr("from");
		var jid = Strophe.getBareJidFromJid(from);
		var chatSession = _chatSessions[jid] || null;
		var type = msg.attr("type");
		var contact;
		var contactName;
		var room;
		var messageTime;

		if (type === "groupchat") {
			room = chatSession.chatWith;
			if (room == null) {
				return true;
			}
			messageTime = room.incomingMucMessage(message);
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
					// create a contact but don't add to roster
					contact = new Contact(null, jid);
				} else {
					jid = Strophe.getBareJidFromJid(from);
					// Is this someone in my roster
					contact = _roster.findContact(jid);
					if (contact) {
						contactName = contact.name;
					} else {
						// create a contact but don't add to roster
						contact = new Contact(null, jid);
						contactName = Strophe.getNodeFromJid(from)
					}
				}
				chatSession = new ChatSession(contact, contactName, Strophe.getResourceFromJid(from), _connection, msg);
				_chatSessions[jid] = chatSession;

				$(document).trigger('start_chatting', chatSession);
			}
		}
		$(document).trigger('new_chat_message', {
			'message' : msg,
			'fromMe' : false,
			'timestamp' : messageTime,
			'type' : type
		});
		return true;
	};

	// called when user click the tab close icon
	var endSession = function(jid) {
		var session = _chatSessions[jid];
		session.endChat();
		delete _chatSessions[jid];
	};

	return {
		init : init,
		statusChanged : statusChanged,
		chatTo : chatTo,
		joinRoomChat : joinRoomChat,
		sendNewMessage : sendNewMessage,
		sendNewTopic : sendNewTopic,
		incomingMessage : incomingMessage,
		endSession : endSession
	};
})());
