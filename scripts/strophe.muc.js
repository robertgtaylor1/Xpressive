function Occupant(jid) {
	this.name = Strophe.getResourceFromJid(jid);
	this.status = "available";
}

Occupant.prototype = {
	startChat : function(jid) {
		var myName = Strophe.getResourceFromJid(jid);
		//TODO: add support
	}
};

function Room(jid, name, conn) {
	this.roomJid = jid;
	this.nickname = "";
	this.connection = conn;
	this.roomName = name;
	this.roomInfoResponse = {};
	this.occupants = [];
	this.joined = false;
	this.messages = [];
	this.presenceResponse = {};
	Strophe.info("new room created: " + this.roomJid);
}

Room.prototype = {

	getInfo : function() {
		Strophe.info("get room info for: " + this.roomJid);
		var attrs = {
			xmlns : Strophe.NS.DISCO_INFO
		};
		var roomInfoIq = $iq({
			to : this.roomJid,
			type : 'get'
		}).c('query', attrs);

		this.connection.sendIQ(roomInfoIq, this.roomInfo.bind(this), this.roomInfoError.bind(this));
	},

	roomInfo : function(iq) {
		Strophe.info("got room info for: " + this.roomJid);
		this.roomInfoResponse = iq;
		Strophe.info("Room Description: " + this.description());
		Strophe.info("Number Of Occupants: " + this.numberOfOccupants());
		
		// notify user code of room change
		$(document).trigger("room_changed", this);
	},

	roomInfoError : function() {
		Strophe.error("ERROR: for room info: " + this.roomJid);
	},

	description : function() {
		var val = "xx";
		if (this.roomInfoResponse) {
			$(this.roomInfoResponse).find('x field').each(function() {
				if ($(this).attr('var') === "muc#roominfo_description") {
					val = $(this).find('value').text();
					return;
				}
			});
		}
		return val;
	},

	numberOfOccupants : function() {
		var val = -1;
		if (this.roomInfoResponse) {
			$(this.roomInfoResponse).find('x field').each(function() {
				if ($(this).attr('var') === "muc#roominfo_occupants") {
					val = $(this).find('value').text();
					return val;
				}
			});
		}
		return val;
	},

	join : function(nickname, password) {
		Strophe.info("join room: " + this.roomJid);
		
		this.nickname = nickname;
		var pw = (password ? password.trim() : "");
		var presence = $pres({
			to : this.roomJid + "/" + this.nickname
		}).c('x', {xmlns : Strophe.NS.MUC});
		if (pw.length > 0){
			presence.c('password', null, pw);
		}
		
		var elem = this.connection.caps.createCapsNode().tree();
		presence.up().cnode(elem);
		
		this.connection.send(presence.tree());		
		this.connection.chat.joinRoomChat(this.roomJid);
		this.getInfo();
	},

	leave : function() {
		Strophe.info("leave room: " + this.roomJid);
		
		var leaveIq = $pres({
			to : this.roomJid + "/" + this.nickname,
			type : 'unavailable'});
		this.connection.send(leaveIq);
		this.getInfo();
	},

	sendMessage : function(messageText) {
		Strophe.info("send message to room: " + this.roomJid);

		var message = $msg({
			to : this.roomJid,
			type : 'groupchat'
		}).c('body').t(messageText);

		//this.messages.push(message);

		this.connection.send(message);
	},

	incomingMucMessage : function(stanza) {
		Strophe.info("got message for room: " + this.roomJid);

		this.messages.push(stanza);

	},

	requiresPassword : function() {
		var isSecure = true;
		if (this.roomInfoResponse){
			$(this.roomInfoResponse).find('feature').each(function() {
				if ($(this).attr('var') === "muc_unsecured") {
					isSecure = false;
					return;
				}
			});
		}
		return isSecure;
	},

	isModerator : function() {
		return false;
	},

	isOwner : function() {
		return true;
	},

	isMember : function() {
		return false;
	},

	isAdmin : function() {
		return true;
	},

	queryOccupants : function() {
		var attrs, info;
		attrs = {
			xmlns : Strophe.NS.DISCO_ITEMS
		};
		info = $iq({
			from : this.connection.jid,
			to : roomJid,
			type : 'get'
		}).c('query', attrs);
		this.connection.sendIQ(info, this._occupantsInfo, this._errorInfo);
	},

	_occupantsInfo : function(iq) {
		Strophe.info("got occupants info for: " + this.roomJid);
		var infoIq = $(iq);
	},

	_errorInfo : function(iq) {
		Strophe.info("ERROR: for occupants info for: " + this.roomJid);
		var errorIq = $(iq);
	},

	addOccupant : function(jid) {
		Strophe.info("add occupant to room: " + jid);
		var newOccupant = new Occupant(jid);
		this.occupants.push(newOccupant);
	},

	removeOccupant : function(jid) {
		Strophe.info("remove occupant from room: " + jid);
		var occupantName = Strophe.getResourceFromJid(jid);
		for (var i = this.occupants.length - 1; i >= 0; i--) {
			if (occupantName === this.occupants[i].name) {
				this.occupants.splice(i, 1);
				return true;
			}
		}
		return false;
	},

	updateOccupant : function(stanza) {
		Strophe.info("update room occupant: ??");

	}
};

function Server(jid, conn) {
	this.serverJid = Strophe.getDomainFromJid(jid);
	this.connection = conn;
	this.serverInfoResponse = {};
	this.serverItemsResponse = {};
	this.rooms = {};
	Strophe.info("new server created: " + this.serverJid);
}

Server.prototype = {

	// This gets the MUC info
	getInfo : function() {
		Strophe.info("get server info for: " + this.serverJid);

		var serverInfoIq = $iq({
			to : this.serverJid,
			type : "get"
		}).c("query", {
			xmlns : Strophe.NS.DISCO_INFO
		});
		this.connection.sendIQ(serverInfoIq, this.serverInfo.bind(this), this.serverInfoError.bind(this));
	},

	serverInfo : function(iq) {
		Strophe.info("got server info for: " + this.serverJid);

		this.serverInfoResponse = iq;

		// disco#items
		var serverItemsIq = $iq({
			to : this.serverJid,
			type : "get"
		}).c("query", {
			xmlns : Strophe.NS.DISCO_ITEMS
		});
		Strophe.info("get server items for: " + this.serverJid);
		this.connection.sendIQ(serverItemsIq, this.serverItems.bind(this), this.serverItemsError.bind(this));
	},

	serverInfoError : function(iq) {
		Strophe.error("ERROR: get server info for: " + this.serverJid);

		var errorIq = $(iq);
	},

	serverItems : function(iq) {
		Strophe.info("got server items for: " + this.serverJid);

		var room;
		this.serverItemsResponse = $(iq);
		var that = this;
		$(iq).find('item').each(function() {
			room = new Room($(this).attr('jid'), $(this).attr('name'), that.connection)
			room.getInfo();
			that.rooms[room.roomJid] = room;
		});

		// notify user code of room changes
		$(document).trigger("rooms_changed", this);
	},

	serverItemsError : function(iq) {
		Strophe.error("ERROR: get server items for: " + this.serverJid);

		var errorIq = $(iq);
	},

	incomingMucMessage : function(stanza) {
		var message = $(stanza);
		var from = message.attr('from');
		var server = Strophe.getBareJidFromJid(from);
		var room = this.rooms[jid];
		if (!room) {
			return false;
		}
		room.incomingMucMessage(stanza);
	},

	isRoom : function(jid) {
		var room = this.getRoom(jid)
		if (room) {
			return true;
		}
		return false;
	},

	getRoom : function(jid) {
		var roomJid = Strophe.getBareJidFromJid(jid);
		var room = this.rooms[roomJid];
		return room;
	}
};

function Servers(connection) {
	this.conn = connection;
	this.servers = {};
}

Servers.prototype = {

	addServer : function(jid) {
		var serverJid = Strophe.getDomainFromJid(jid);
		this.servers[serverJid] = new Server(serverJid, this.conn);
		this.servers[serverJid].getInfo();
	},

	removeServer : function(jid) {
		var serverJid = Strophe.getDomainFromJid(jid);
		delete this.servers[serverJid];
	},

	incomingMucMessage : function(stanza) {
		var from, server, serverJid
		var message = $(stanza);
		var type = message.attr('type');
		if (type === 'groupchat') {

			from = message.attr('from');
			serverJid = Strophe.getDomainFromJid(from);
			server = this.servers[serverJid];
			if (server) {
				return server.incomingMucMessage(stanza);
			}
		}
		return false;
	},

	isRoom : function(jid) {
		var server = this.getServer(jid);
		if (server) {
			return server.isRoom(jid);
		}
		return false;
	},

	getServer : function(jid) {
		var serverJid = Strophe.getDomainFromJid(jid);
		var server = this.servers[serverJid];
		return server;
	},

	getRoom : function(jid) {
		var room = null;
		var server = this.getServer(jid);
		if (server){
			room = server.getRoom(jid);
		}
		return room;
	},
};

Strophe.addConnectionPlugin('muc',(function() {
	var init, statusChanged, processDiscoItems, join, leave, isRoomSecure, 
	    handlePresence, getRooms, createRoom;
	// local variables
	var _connection, _servers;
	    
	init = function(connection) {
		Strophe.debug("init muc plugin");

		_connection = connection;
		_servers = {};

		Strophe.addNamespace('MUC', 'jabber:iq:muc');
	};

	// called when connection status is changed
	statusChanged = function(status) {
		if (status === Strophe.Status.CONNECTED) {
			_servers = new Servers(_connection);
			_connection.addHandler(this.handlePresence.bind(this), Strophe.NS.MUC_USER, "presence");

		} else if (status === Strophe.Status.DISCONNECTED) {
			_servers = {};
		}
	};

	processDiscoItems = function(iq) {
		var discoItems = $(iq);
		var mucJid;
		var mucInfoRequest;
		var hasMucItem = discoItems.find('item').each(function() {
			if ($(this).attr('name') === 'conference') {
				mucJid = $(this).attr('jid');
				return;
			}
		});
		if (mucJid) {
			_servers.addServer(mucJid);
		}
	};

	join = function(roomJid, nickname, password) {
		var room = _servers.getRoom(roomJid);
		room.nickname = nickname;

		$(document).trigger('join_room', room);

		room.join(nickname, password);
	};

	leave = function(roomJid) {
		var room = _servers.getRoom(roomJid);
		//room.nickname = null;
		room.leave();
	};

	isRoomSecure = function(roomJid) {
		var room = _servers.getRoom(roomJid);
		if (room) {
			return room.requiresPassword();
		}
		return true;
	};

	handlePresence = function(stanza) {
		var nickname;
		var presence = $(stanza);
		var from = presence.attr('from');
		var room = _servers.getRoom(from);
		if (room) {
			nickname = Strophe.getResourceFromJid(from);
			if (nickname === room.nickname) {
				room.presenceResponse = stanza;
				Strophe.info("Presence received for: " + from);
			}
		} else {
			Strophe.info("Presence ignored for: " + from);
		}
		return true;
	};
	
	refreshInfo = function(jid) {
		_servers.getRoom(jid).getInfo();
	}

	getRoom = function(jid) {
		return _servers.getRoom(jid);
	};

	createRoom = function(server, name) {
		// TODO
	};
	
	return {
		init : init, 
		statusChanged : statusChanged,  
		processDiscoItems : processDiscoItems, 
		join : join, 
		leave : leave, 
		isRoomSecure : isRoomSecure, 
	    getRoom : getRoom, 
	    createRoom : createRoom,
	    refreshInfo : refreshInfo
	}
})());
