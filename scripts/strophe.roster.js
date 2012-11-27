// Contact object
function Contact(item, jid) {
	var $item = item;
	if (!$item) {
		this.jid = jid;
		this.item = $item;
		this.name = Strophe.getNodeFromJid(this.jid);
		this.subscription = "none";	
		this.ask = "";	
		this.groups = {};	
	} else {
		this.jid = $item.attr('jid');

		this.item = $item;
		this.name = $item.attr('name') || Strophe.getNodeFromJid(this.jid);
		this.subscription = $item.attr('subscription') || "none";	
		this.ask = $item.attr('ask') || "";	
		this.groups = $item.find('group') || {};	
	}
	Strophe.debug("Contact created for: " + this.jid)

	this.resources = {};
	this.vCard = {};
	this.chatSession = null;
	this.ptype = null;
}

Contact.prototype = {
	// compute whether user is online from their
	// list of resources
	online : function() {
		var result = false;
		for (var k in this.resources) {
			result = true;
			break;
		}
		return result;
	},

	chatTo : function() {
		// create a new Chat session
		this.chatSession = Xpressive.connection.chat.chatTo(this);
	},

	update : function(item) {
		this.item = item;
		var _name = item.attr('name');

		Strophe.debug("Contact.update for: " + this.jid);

		if (_name !== undefined) {
			if (this.name !== _name) {
				this.name = _name;
				$(document).trigger('contactname_changed', this);
			}
		}
		var _subscription = item.attr('subscription');
		if (_subscription !== undefined){
		 	this.subscription = _subscription;
		}
		var _ask = item.attr('ask');
		if (_ask !== undefined){
		 	this.ask = _ask;
		}
		var _groups = item.find('group');
		if (_groups !== undefined){
		 	this.groups = _groups;
		}
	},

	endChat : function() {
		var message = $message({
			to : jid
		}).c("gone", {
			xmlns : Strophe.NS.CHATSTATES
		});

		Xpressive.connection.send(message);
	},

	getVCard : function() {
		//TODO:
	},

	getGroups : function() {
		var _list = [];
		if (this.groups.length === 0){
			return "none";
		}
		this.groups.each(function(){
			_list.push(this.textContent);
		})
		return _list.join(", ");		
	},

	getInfo : function() {
		var ret = "offline";

		if (this.resources) {
			$.each(this.resources, function(key, resource) {
				ret = "[" + key + "]";
				ret += " Status: " + (resource.show || "online");
				if (resource.status) {
					ret += ": " + resource.status;
				}
				if (resource.timestamp !== undefined) {
					ret += " Updated at: " + Xpressive._formatDate(resource.timestamp, "{Hours:2}:{Minutes:2} on {Date}/{Month}/{FullYear}");
				}				
				return;
			});
		}
		return ret;
	},

	toString : function() {
		return "jid:" + this.jid + ", name:" + this.name + ", subscription:" + this.subscription + ", groups:" + this.groups.toString();
	}
};

function Contacts(connection) {
	this.conn = connection;
	this.list = {};
}

Contacts.prototype = {
	// called when roster udpates are received
	rosterChanged : function(iq) {
		var item = $(iq).find('item');
		var jid = item.attr('jid');
		var subscription = item.attr('subscription') || "";
		var ask = item.attr('ask') || "";
		var contact = {};
		var _list = {};

		Strophe.info("rosterChange for: " + jid + " [" + subscription + "]");

		// acknowledge receipt
		this.conn.send($iq({
			type : "result",
			id : $(iq).attr('id')
		}).tree());

		if (subscription === "remove") {
			// removing contact from roster
			contact = new Contact(item);
			delete this.list[jid];
		} else {
			contact = this.list[jid];
			if (!contact) {
				// adding contact to roster
				contact = new Contact(item);
				this.list[jid] = contact;

				if (ask === "" && subscription === "none") {
					// send a presence(type=subscribe)
					this.conn.send($pres({
						to : jid,
						type: 'subscribe',
					}).tree());
				} else {
					Strophe.info("rosterChange ignored");
				}
			} else {			
				contact.update(item);
			}
		}
		_list[jid] = contact;		
		// notify user code of roster changes
		$(document).trigger("roster_changed", _list);

		return true;
	},

	// called when presence stanzas are received
	presenceChanged : function(presence) {
		var from = $(presence).attr("from");
		var jid = Strophe.getBareJidFromJid(from);		

		if (jid === this.conn.me.myJid()) {
			// It's my presence so ignore it
			return true;
		}

		var resource = Strophe.getResourceFromJid(from);
		var ptype = $(presence).attr("type") || $(presence).find("show").text() || "available";

		Strophe.info("presenceChange for: " + from + " [" + ptype + "]");

		if (ptype === "error") {
			//TODO: ignore error presence for now
			return true;
		}
		var contact = this.list[jid];
		if (!contact) {
			// it might be a room
			if (Xpressive.connection.muc.isServer(jid))
			{
				//Xpressive.connection.muc.handlePresence(presence);
				return true;
			}
			// This is someone we don't have on our roster so pop-up the dialog
			if (ptype === "subscribe") {
				$(document).trigger("ask_subscription", jid);
			}			
		} else {
			contact.ptype = ptype;

			if (ptype === "unavailable") {
				// remove resource, contact went offline
				try {
					delete contact.resources[resource];
				} catch (e) { }
			} else if (ptype === "subscribe") {
				// this is someone we know about so accept request
				Xpressive.connection.send($pres({
					to : jid,
					type : "subscribed"
				}).tree());				
			} else if (ptype === "unsubscribe") {
				// this is someone we know about so accept request
				Xpressive.connection.send($pres({
					to : jid,
					type : "unsubscribed"
				}).tree());
			} else if (ptype=== "subscribed") {
				// ignore this
			} else {		
				// contact came online or changed status
				if (resource) { 
					// make sure we have a resource string
					var stamp = $(presence).find("delay").attr("stamp")
					var time = stamp === undefined ? new Date() : new Date(stamp);

					contact.resources[resource] = {
						show : $(presence).find("show").text() || "online",
						status : $(presence).find("status").text(),
						timestamp: time
					};
				}
			}

			// notify user code of roster changes
			$(document).trigger("presence_changed", contact);
		}
		return true;
	}
}

// example roster plugin
Strophe.addConnectionPlugin('roster', (function() {
	var init, statusChanged, findContact, deleteContact, addContact, modifyContact, subscribe, unsubscribe;
	// local variables
	var _connection, _contacts;

	init = function(connection) {
		Strophe.debug("init roster plugin");

		_connection = connection;
		_contacts = {};
	};

	// called when connection status is changed
	statusChanged = function(status) {
		var roster_iq, contact;

		if (status === Strophe.Status.CONNECTED) {
			_contacts = new Contacts(_connection);

			// set up handlers for updates
			_connection.addHandler(_contacts.rosterChanged.bind(_contacts), Strophe.NS.ROSTER, "iq", "set");
			_connection.addHandler(_contacts.presenceChanged.bind(_contacts), null, "presence");

			// build and send initial roster query
			roster_iq = $iq({
				type : "get"
			}).c('query', {
				xmlns : Strophe.NS.ROSTER
			});

			_connection.sendIQ(roster_iq, function(iq) {
				Strophe.info("roster_iq received.");

				$(iq).find("item").each(function() {
					// build a new contact and add it to the roster
					contact = new Contact($(this));
					// TODO move to prototype
					_contacts.list[$(this).attr('jid')] = contact;
				});

				// let user code know something happened
				$(document).trigger('roster_changed', _contacts.list);

				// TODO find a way to fire an event to do this
				_connection.me.available();
			});
		} else if (status === Strophe.Status.DISCONNECTED) {
			// set all users offline
			// TODO move to prototype
			for (contact in this.contacts.list) {
				_contacts.list[contact].resources = {};
			}

			// notify user code
			$(document).trigger('roster_changed', _contacts.list);
		}
	};

	chatToDirect = function(jid) {
		var _contact = findContact(Strophe.getBareJidFromJid(jid));
		
		if (!_contact) {
			_contact = new Contact(null, jid);
		}		
		_contact.chatTo();
	}

	chatTo = function(jid) {
		var _contact = findContact(Strophe.getBareJidFromJid(jid));
		_contact.chatTo();	
	};

	findContact = function(jid) {
		return _contacts.list[jid] || null;
	};

	// delete a contact from the roster
	deleteContact = function(jid) {
		var iq = $iq({
			type : "set"
		}).c("query", {
			xmlns : Strophe.NS.ROSTER
		}).c("item", {
			jid : jid,
			subscription : "remove"
		});
		_connection.sendIQ(iq);
	};

	// add a contact to the roster
	addContact = function(jid, name, groups) {
		var iq = $iq({
			type : "set"
		}).c("query", {
			xmlns : Strophe.NS.ROSTER
		}).c("item", {
			name : name || "",
			jid : jid
		});
		var _groups = groups.split(" ");
		if (_groups && _groups.length > 0) {
			$.each(_groups, function() {
				if (this.length > 0)
					iq.c("group").t(this).up();
			});
		}
		_connection.sendIQ(iq);
	};

	// modify a roster contact
	modifyContact = function(jid, name, groups) {
		addContact(jid, name, groups);
	};

	// subscribe to a new contact's presence
	subscribe = function(jid, name, groups) {
		addContact(jid, name, groups);

		var presence = $pres({
			to : jid,
			"type" : "subscribe"
		});
		_connection.send(presence);
	};

	// unsubscribe from a contact's presence
	unsubscribe = function(jid) {
		var presence = $pres({
			to : jid,
			"type" : "unsubscribe"
		});
		_connection.send(presence);

		deleteContact(jid);
	};

	return {
		init : init,
		statusChanged : statusChanged,
		chatTo : chatTo,
		chatToDirect : chatToDirect,
		findContact : findContact,
		deleteContact : deleteContact,
		addContact : addContact,
		modifyContact : modifyContact,
		subscribe : subscribe,
		unsubscribe : unsubscribe
	}
})());