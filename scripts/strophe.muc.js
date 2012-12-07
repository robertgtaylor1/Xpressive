function Capabilities(caps) {
	this.c = $(caps);
}

Capabilities.prototype = {
	ver : function () { 
		return this.c.attr('ver'); 
	},
	
	node : function () {
		return this.c.attr('node');
	}
};

function Occupant(jid) {
	this.item = {};
	this.fullJid = jid;
	this.capabilities = {};
	this.show = "";
	this.status = "";
	thisIsMe = false;
}

Occupant.prototype = {
	
	nickname : function () {
		return Strophe.getResourceFromJid(this.fullJid);
	},
	 
	getStatus : function () {
		if (this.role === 'none')
			return 'unavailable';
		return this.status;
	},
	
	affiliation : function () {
		var _affiliation = "none";
		
		if (this.item) {
			_affiliation = this.item.attr('affiliation') || "none";
		}
		return _affiliation;
	},
	
	role : function () {
		var _role = "none";
		
		if (this.item) {
			_role = this.item.attr('role') || "none";
		}
		return _role;
	},
	
	realJid : function () {
		return this.item ? this.item.attr('jid') || null : null;
	},
	
	isThisMe : function () {
		 return this.thisIsMe;
	},
	 
	startChat : function (jid) {
		var myName = Strophe.getResourceFromJid(jid);
		//TODO: add support
	},
	
	presenceUpdate : function(pres) {
		this.item = pres.find('item');
		var capsElem = pres.find('c');
		if (capsElem && capsElem.length > 0) {
			this.capabilitiesUpdate(capsElem);
		}
		var statusElem = $(pres).find('status');
		if (statusElem && statusElem.length > 0) {
			this.status = statusElem.text();
		}
		var showElem = $(pres).find('show');
		if (showElem && showElem.length > 0) {
			this.show = showElem.text();
		}
		var xElem = $(pres).find("x status[code='110']");
		if (xElem && xElem.length > 0) {
			this.thisIsMe = true;
		}
		if (this.thisIsMe) {
			$(document).trigger("update_my_room_info", { 
					"jid": this.fullJid, 
					"affiliation": this.affiliation(),
					"role":  this.role()}
				);
		}
	},
	
	capabilitiesUpdate : function(caps) {
		this.capabilities = new Capabilities(caps);
	},
	
	toString : function() {
		return "Occupant: Nickname=" + this.nickname() + ", " +
						 "RealJid=" + this.realJid() + ", " + 
						 "isThisMe=" + this.isThisMe() + ", " +	
						 "affiliation=" + this.affiliation() + ", " + 	
						 "role=" + this.role() + ", " + 	
						 "status=" + this.getStatus() + ", " + 	
						 "show=" + this.show + ". "; 	
	}
};

function Room(jid, name, conn) {
	this.jid = Strophe.getBareJidFromJid(jid);
	this.myNickname = "";
	this.myAffiliation = "none";
	this.myRole = "none";
	this.connection = conn;
	this.roomName = name;
	this.roomInfoResponse = {};
	this.occupants = {};
	this.joined = false;
	this.presenceResponse = {};
	this.form = {};
	this.isConfigured = true;
	this.chatSession = null;
	Strophe.info("new room created: " + this.jid);
}

Room.prototype = {
	
	canModifySubject : function() {
		if (roomInfoResponse) {
			var fld = $(roomInfoResponse).find('field[var="muc#roominfo_subjectmod"]');
			if (fld) {
				value = $(fld).find('value').text();
				if (value === "1")
					return true;	
			}		
		}
		if (this.iAmAdmin())
			return true;
		return false;
	},
	
	getInfo : function() {
		Strophe.info("Room: get room info for: " + this.jid);
		var attrs = {
			xmlns : Strophe.NS.DISCO_INFO
		};
		var roomInfoIq = $iq({
			to : this.jid,
			type : 'get'
		}).c('query', attrs);

		this.connection.sendIQ(roomInfoIq, this.roomInfoResult.bind(this), this.roomInfoError.bind(this));
	},

	roomInfoResult : function(iq) {
		Strophe.info("got room info for: " + this.jid);
		this.roomInfoResponse = iq;
		var name = $(iq).find('identity').attr('name');
		if (name && this.roomName !== name) {
			this.roomName = name;
			$(document).trigger("roomname_changed", this);			
		}
		Strophe.info("Room Description: " + this.description());
		Strophe.info("Number Of Occupants: " + this.numberOfOccupants());
		
		this.form = Form.fromXML($(iq).find('x'));
		
		// notify user code of room change
		$(document).trigger("room_changed", this);
	},

	roomInfoError : function() {
		Strophe.error("Room ERROR: for room info: " + this.jid);
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
	
	// This function is used after a room is created as you are
	// automatically added to the room by the serever and don't
	// have to send another presence stanza.
	rejoin : function() {
		this.chatSession = this.connection.chat.joinRoomChat(this);		
	},

	join : function(nickname, password) {
		if (this.chatSession) {
			$(document).trigger('set_focus_on_tab', this.jid);
			return;
		}
		Strophe.info("Room: join room: " + this.jid);
		
		this.myNickname = nickname;

		$(document).trigger('join_room', this);
		
		var pw = (password ? password.trim() : "");
		var presence = $pres({
			to : this.jid + "/" + this.myNickname
		}).c('x', {xmlns : Strophe.NS.MUC});
		if (pw.length > 0){
			presence.c('password', null, pw);
		}
		
		var elem = this.connection.caps.createCapsNode().tree();
		presence.up().cnode(elem);		

		this.connection.send(presence.tree());		
		this.chatSession = this.connection.chat.joinRoomChat(this);
		this.getInfo();
	},

	// called by Session.endChat
	leave : function() {
		Strophe.info("leave room: " + this.jid);
		var leavePres = $pres({
			to : this.jid + "/" + this.myNickname,
			type : 'unavailable'});
		this.connection.send(leavePres);
		this.getInfo();
		this.chatSession = null;
		this.occupants = {};
	},

	sendMessage : function(messageText) {
		Strophe.info("send message to room: " + this.jid);

		var message = $msg({
			to : this.jid,
			type : 'groupchat'
		}).c('body').t(messageText);

		this.connection.send(message);
	},

	incomingMucMessage : function(message) {
		Strophe.info("got message for room: " + this.jid);
		var messageTime;
		
		delay = $(message).find('delay');
		if (delay.length === 0){
			delay = $(message).find('x');
		}
		if (delay.length !== 0){
			var stamp = delay.attr('stamp');
			messageTime = new Date(stamp);
		}

		this.chatSession.recvMessage(message, messageTime);
		return messageTime;
	},

	inviteReceived: function(from, fromName, reason, password) {
		Strophe.info("got invite for room: " + this.jid);
		
		$(document).trigger("prompt_for_invite_response", {
			"fromJid" : from,
			"fromName" : fromName,
			"reason" : reason,
			"password" : password,
			"roomJid" : this.jid,
			"roomName" : this.roomName,
			"accept" : this.acceptInvite.bind(this),
			"decline" : this.declineInvite.bind(this),
			"ignore" : null
		})		
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

	iAmModerator : function() {
		return (this.myRole === 'moderator');
	},

	iAmOwner : function() {
		return (this.myAffiliation === 'owner');
	},

	iAmMember : function() {
		return (this.iAmModerator || this.myRole === 'participant');
	},

	iAmAdmin : function() {
		return (this.iAmOwner || this.myAffiliation === 'administrator');
	},

	iAmBanned : function() {
		return false;
	},

	iHaveVoice : function() {
		return true;
	},
	
	iCanInvite : function() {
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
		this.connection.sendIQ(info, this._occupantsInfo.bind(this), this._errorInfo.bind(this));
	},

	_occupantsInfo : function(iq) {
		Strophe.info("Room: got occupants info for: " + this.jid);
		var infoIq = $(iq);
	},

	_errorInfo : function(iq) {
		Strophe.info("Room ERROR: for occupants info for: " + this.jid);
		var errorIq = $(iq);
	},

	addOccupant : function(jid, pres) {
		return this._addOccupant(jid, pres);
	},

	_addOccupant : function(jid, pres) {
		var occupant = this.findOccupant(jid);
		if (!occupant) {
			occupant = new Occupant(jid);			
			this.occupants[occupant.nickname()] = occupant;
		}
		occupant.presenceUpdate(pres);
		if (!occupant.thisIsMe) {
			// fire joined room event
			$(document).trigger("someone_has_joined_room", occupant);
		}
		return occupant;
	},
	
	findOccupant : function(jid) {
		var nickname = Strophe.getResourceFromJid(jid);
		return this.occupants[nickname];	
	},
	
	removeOccupant : function(jid) {
		Strophe.info("Room: remove occupant from room: " + jid);
		// fire left room event
		var nickname = Strophe.getResourceFromJid(jid);
		$(document).trigger("someone_has_left_room", this.occupants[nickname]);		
		delete this.occupants[nickname];
		return true;
	},

	updateOccupant : function(pres) {
		var occupantJid = $(pres).attr('from');
		Strophe.info("Room: update room occupant: " + occupantJid);
		return this._addOccupant(occupantJid, pres);
	},
	
	invite : function() {
		$(document).trigger("send_invitation", { 
				room : this, 
				okHandler : this.sendInvite.bind(this) 
			});
	},
	
	sendInvite : function(data) {
		var msg = $msg({
			"to" : this.jid
		}).c("x", {
			"xmlns" : Strophe.NS.MUC_USER
		}).c("invite", { 
			"to" : data.jid});
		
		if (data.reason) {
			msg.c("reason").t(data.reason).up();
		}
		
		if (data.password) {
			msg.up().c("password").t(data.password);
		}		
		
		this.connection.send(msg.tree());
	},
	
	acceptInvite : function(nickname, password) {
		this.join(nickname, password);
	},
	
	declineInvite : function(from, sender, reason) {
		var msg = $msg({
			"to" : from
		}).c("x", {
			"xmlns" : Strophe.NS.MUC_USER
		}).c("decline", { 
			"to" : sender});
			
		if (reason) {
			msg.c("reason").t(reason);
		}
		
		this.connection.send(msg.tree());
	}
};

function Server(jid, conn) {
	this.serverJid = Strophe.getDomainFromJid(jid);
	this.connection = conn;
	this.serverInfoResponse = {};
	this.serverItemsResponse = {};
	this.rooms = {};
	Strophe.info("Server: new server created: " + this.serverJid);
};

Server.prototype = {

	// This gets the MUC info
	getInfo : function() {
		Strophe.info("Server: get info for: " + this.serverJid);

		var serverInfoIq = $iq({
			to : this.serverJid,
			type : "get"
		}).c("query", {
			xmlns : Strophe.NS.DISCO_INFO
		});
		this.connection.sendIQ(serverInfoIq, this.serverInfo.bind(this), this.serverInfoError.bind(this));
	},

	removeFromList : function(roomJid) {
		delete this.rooms[roomJid];
		// update the UI room list
		$(document).trigger('remove_room_from_list', roomJid);		
	},

	serverInfo : function(iq) {
		Strophe.info("Server: got info for: " + this.serverJid);

		this.serverInfoResponse = iq;

		// disco#items
		var serverItemsIq = $iq({
			to : this.serverJid,
			type : "get"
		}).c("query", {
			xmlns : Strophe.NS.DISCO_ITEMS
		});
		Strophe.info("Server: get items for: " + this.serverJid);
		this.connection.sendIQ(serverItemsIq, this.serverItems.bind(this), this.serverItemsError.bind(this));
	},

	serverInfoError : function(iq) {
		Strophe.error("ERROR: get server info for: " + this.serverJid);

		var errorIq = $(iq);
	},

	serverItems : function(iq) {
		Strophe.info("Server: got items for: " + this.serverJid);

		var room;
		this.serverItemsResponse = $(iq);
		var that = this;
		$(iq).find('item').each(function() {
			room = new Room($(this).attr('jid'), $(this).attr('name'), that.connection)
			room.getInfo();
			that.rooms[room.jid] = room;
		});

		// notify user code of room changes
		$(document).trigger("rooms_changed", this);
	},

	serverItemsError : function(iq) {
		Strophe.error("Server ERROR: get server items for: " + this.serverJid);

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
	},
	
	destroyRoom : function(jid, reason, altRoomJid, altRoomPassword) {
		var roomJid = Strophe.getBareJidFromJid(jid);		
		// Build Destroy Iq
		var destroyIq = $iq({
			"to" : roomJid,
			"type" : "set"
		}).c('query', {
			"xmlns" : Strophe.NS.MUC_OWNER
		});
		
		if (altRoomJid) {
			destroyIq.c('destroy', { "jid": altRoomJid })
		} else {
			destroyIq.c('destroy')
		}
		if (altRoomPassword) {
			destroyIq.c('password').t(altRoomPassword).up();
		}
		if (reason) {
		 	destroyIq.c('reason').t(reason);
		}
		
		this.connection.sendIQ(destroyIq.tree(), this._roomDestroyed.bind(this));
	},
	
	_roomDestroyed : function(iq) {
		var roomJid = $(iq).attr('from');
		this.removeFromList(roomJid);
	}	
};

function Servers(connection) {
	this.conn = connection;
	this.servers = {};
};

Servers.prototype = {
	
	refresh : function(jid) {
		if (jid) {
			this.getServer(jid).getInfo();
		} else {
			for (var serverJid in this.servers)
			{
				this.servers[serverJid].getInfo();
			}
		}
	},

	addServerAndGetInfo : function(jid) {
		this.addServer(jid).getInfo();
	},

	addServer : function(jid) {
		var serverJid = Strophe.getDomainFromJid(jid);
		this.servers[serverJid] = new Server(serverJid, this.conn);
		return this.servers[serverJid];
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

	getMyServer : function() {
		// this will get the first server in the object
		// TODO: really need to be better at this as there may be multiple servers
		//       and this needs to be 'my' server
		return this.servers[Object.keys(this.servers)[0]];
	},
 
	getRoom : function(jid) {
		var room = null;
		var server = this.getServer(jid);
		if (server){
			room = server.getRoom(jid);
		}
		return room;
	},
	
	destroyRoom : function(jid, reason, altRoomJid, altRoomPassword) {
		var room = null;
		var server = this.getServer(jid);
		if (server){
			server.destroyRoom(jid, reason, altRoomJid, altRoomPassword);
		}
	},
	
	updatePresence : function(pres) {
		var jid = $(pres).attr('from');
		var presType = $(pres).attr('type');

		var room = this.getRoom(jid);
		var occupant;
		if (room) {
			if (presType === "unavailable") {
				room.removeOccupant(jid);				
			} else {
				occupant = room.updateOccupant(pres);
			}
		}
		return occupant;
	},
	
	getOrAddRoom : function(jid) {
		var server;
		var roomJid = Strophe.getBareJidFromJid(jid);
		var room = this.getRoom(roomJid);
		if (!room) {
			server = this.getServer(roomJid);
			if (!server) {
				server = this._servers.addServer(roomJid);
			}
			room = new Room(roomJid, null, this.conn);
			room.getInfo();
			server.rooms[room.jid] = room;
		}
		return room;
	}
};

Strophe.addConnectionPlugin('muc',(function() {
	var init, statusChanged, processDiscoItems, join, leave, isRoomSecure, 
	    handlePresence, getRoom, getRooms, createRoom, configureRoom;
	// local variables
	var _connection, _servers;
	    
	init = function(connection) {
		Strophe.debug("init muc plugin");

		_connection = connection;
		_servers = {};

		Strophe.addNamespace('MUC_USER', 'http://jabber.org/protocol/muc#user');
		Strophe.addNamespace('MUC_OWNER', 'http://jabber.org/protocol/muc#owner');
		Strophe.addNamespace('X_DATA', 'jabber:x:data');
	};

	// called when connection status is changed
	statusChanged = function(status) {
		if (status === Strophe.Status.CONNECTED) {
			_servers = new Servers(_connection);
			//_connection.addHandler(this.handlePresence.bind(this), Strophe.NS.MUC, "presence");
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
			_servers.addServerAndGetInfo(mucJid);
		}
	};

	join = function(roomJid, nickname, password) {
		var room = _servers.getRoom(roomJid);
		room.join(nickname, password);
	};

	leave = function(roomJid) {
		var room = _servers.getRoom(roomJid);
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
		var presType = presence.attr('type');		
		var from = presence.attr('from');
		var room = _servers.getRoom(from);
		var occupant;
		
		if (presType === "error") {
			var error = presence.find('error');
			if (error.length > 0) {
				var errorType = error.attr('type');
				var errorCode = error.next().prop("tagName");
				
				Strophe.error("MUC presence error: type=" + errorType + ", code=" + errorCode);
				
				switch (errorType){
					case "auth":
						switch (errorCode) {
							case "forbidden":
								// banned/outcast
								break;
							case "not-authorized":
								// password not supplied or incorrect
								break;
							case "registration-required":
								// members only
								break;
							default:
								break;
						}
						break;
					case "cancel":
						switch (errorCode) {
							case "conflict":
								// nickname clash
								break;
							case "not-allowed":
								// can't create room
								break;
							case "item-not-found":
								// room doesn't exist or is locked 
								break;
							default:
								break;
						}
						break;
					case "wait":
						switch (errorCode) {
							case "service-unavailable":
								// user limit reached
								break;
							default:
								break;
							}
						break;
					case "modify":
						switch (errorCode) {
							case "jid-malformed":
								// Nickname missing
								break;
							default:
								break;
							}
						break;
					default:
						break;
				}
			}
		} else {
			if (room && room.isConfigured) {
				Strophe.info("[MUC] Presence received for: " + from);
		
				nickname = Strophe.getResourceFromJid(from);
				if (nickname === room.myNickname) {
					// this is me
					if (presType === 'unavailable') {
						// I have left the room					
						$(document).trigger("I_have_left_room", room);
						return true;
					}
				}			
				occupant = _servers.updatePresence(presence);
				
				if (presType === 'unavailable') {
					// Someone has left the room
					return true;
				}
				
				$(document).trigger("update_room_occupants", occupant);
			} else {
				Strophe.info("[MUC] Presence for new room: " + from);
				// request room config
				_requestRoomForm(from);
			}
		}
		return true;
	};	

	_requestRoomForm = function(roomJid) {
		var iq = $iq({
			type: "get",
			to: Strophe.getBareJidFromJid(roomJid)
		}).c('query', {xmlns: Strophe.NS.MUC_OWNER});
			
		_connection.sendIQ(iq, _formRequestHandler.bind(this), _formRequestErrorHandler.bind(this));
	};
	
	_formRequestHandler = function(iq) {
		// notify user code of room change
		$(document).trigger("create_room_form", {"iq" : iq, "onOk": configureThisRoom, "onCancel": cancelThisRoom });			
	};
	
	_formRequestErrorHandler = function(iq) {
		Strophe.error("Create Room Form request failed.")
	};
	
	var configureThisRoom = function(iq, form) {
		var xform = Form.fromHTML(form);
		xform.type = "submit";					
		var xml = xform.toXML();
		
		var iqResponse = $iq({
				to : $(iq).attr('from'),
				type : "set"
			})
			.c('query', {
				xmlns : Strophe.NS.MUC_OWNER
			})
			.cnode(xml);
			
		_connection.sendIQ(iqResponse.tree(), this.on_configure_room_result.bind(this), this.on_create_room_error.bind(this));		
	};
	
	var cancelThisRoom = function(iq) {
		var roomJid = $(iq).attr('from');
		var iqResponse = $iq({
				to : roomJid,
				type : "set"
			})
			.c('query', {
				xmlns : Strophe.NS.MUC_OWNER
			})
			.c('x', {
				xmlns : Strophe.NS.X_DATA, 
				type : "cancel"
			});
			
		_connection.sendIQ(iqResponse.tree());
		//_servers.removeFromList(roomJid);
	};
	
	on_configure_room_result = function(iq) {
		var from = $(iq).attr('from');
		// add room to list
		refreshInfo(from);
		// now join it
		var room = getRoom(from);
		if (!room.isConfigured) {	
			room.isConfigured = true;	
			room.rejoin();
		}
	};
	
	on_create_room_error = function(iq) {
		
	};
	
	refreshInfo = function(jid) {
		_servers.getRoom(jid).getInfo();
	};

	isServer = function(jid) {
		var server = _servers.getServer(jid);
		if (server)
			return true;
		return false;
	};
	
	getOrAddRoom = function(jid) {
		return _servers.getOrAddRoom(jid);
	};
	
	getRoom = function(jid) {
		return _servers.getRoom(jid);
	};

	createRoom = function(roomName, nickname) {
		var myServer = _servers.getMyServer();
		var roomJid = roomName + "@" + myServer.serverJid;
		var newRoom = new Room(roomJid, "[" + roomName + "]...not configured", _connection);
		newRoom.isConfigured = false;
		newRoom.myNickname = nickname;
		myServer.rooms[roomJid] = newRoom;
		
		// request form
		var request = $pres({
				to : roomJid + "/" + nickname
			}).c('x', {xmlns : Strophe.NS.MUC});
		
		_connection.send(request);
	};
	
	destroyRoom = function(jid, reason, altRoomJid, altRoomPassword) {
		_servers.destroyRoom(jid, reason, altRoomJid, altRoomPassword);
	};
	
	configureRoom = function(roomJid) {
		_requestRoomForm(roomJid);
	};

	return {
		init : init, 
		statusChanged : statusChanged,  
		processDiscoItems : processDiscoItems, 
		join : join, 
		leave : leave, 
		isServer : isServer,
		isRoomSecure : isRoomSecure, 
	    getRoom : getRoom, 
	    getOrAddRoom : getOrAddRoom,
	    createRoom : createRoom,
	    destroyRoom : destroyRoom,
	    refreshInfo : refreshInfo,
	    handlePresence : handlePresence,
	    configureRoom : configureRoom
	}
})());
