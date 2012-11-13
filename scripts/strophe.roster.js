// Contact object
function Contact(item) {
	var $item = item;
	this.jid = $item.attr('jid');

	Strophe.debug("Contact created for: " + jid)

	this.item = $item;
	
	this.name = $item.attr('name');
	if (this.name === undefined){
		 this.name = Strophe.getNodeFromJid(this.jid);
	}
	this.resources = {};
	this.subscription = $item.attr('subscription');
	if (this.subscription === undefined) {
		 this.subscription = "none";
	}
	this.ask = $item.attr('ask');
	if (this.ask === undefined) {
		 this.ask = "";
	}
	this.groups = $item.find('group');
	if (this.groups === undefined) {
		 this.groups = {};
	}
	this.vCard = {};
	this.chatSession = null;
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
		if (_name !== undefined) {
			this.name = _name;
		}
		var _subscription = $item.attr('subscripton');
		if (_subscription !== undefined){
		 	this.subscription = _subscription;
		}
		var _ask = $item.attr('ask');
		if (_ask !== undefined){
		 	this.ask = _ask;
		}
		var _groups = $item.find('group');
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

	changeName : function(newName) {
		//TODO:
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
		
		if (subscription === "remove") {
			// removing contact from roster
			$(document).trigger("roster_changed", { jid : item });
			delete this.list[jid];
			return true;
		} else if (subscription === "none") {
			// adding contact to roster
			if (ask === "") {
				contact = new Contact(item);
				this.list[jid] = contact;
				// send a presence(type=subscribe)
				this.conn.send($pres({
					to : jid,
					type: 'subscribe',
				}).tree());
			} else if (ask === "subscribe"){
				contact = this.list[jid];
				contact.update(item);
			}
		} else {
			// modifying contact on roster
			contact = this.list[jid];
			contact.update(item);
		}
		// TODO : look at this. It could be handled by an event (trigger)
		// acknowledge receipt
		this.conn.send($iq({
			type : "result",
			id : $(iq).attr('id')
		}).tree());

		// notify user code of roster changes
		$(document).trigger("roster_changed", this.list);
		 
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

		Strophe.info("presence change for: " + from + " [" + ptype + "]");

		if (ptype === "error") {
			//TODO: ignore error presence for now
			return true;
		}
		if (!this.list[jid]) {
			// This is someone we don't have on our roster so pop-up the dialog
			if (ptype === "subscribe") {
				$(document).trigger("ask_subscription", jid);
			}			
		} else if (ptype === "unavailable") {
			// remove resource, contact went offline
			try {
				delete this.list[jid].resources[resource];
			} catch (e) { }
		} else if (ptype === "subscribe") {
			// this is someone we know about so accept request
			Xpressive.connection.send($pres({
				to : jid,
				type : "subscribed"
			}).tree());
		} else {		
			// contact came online or changed status
			this.list[jid].resources[resource] = {
				show : $(presence).find("show").text() || "online",
				status : $(presence).find("status").text()
			};
		}

		// notify user code of roster changes
		$(document).trigger("presence_changed", this.list[jid]);

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
		findContact : findContact,
		deleteContact : deleteContact,
		addContact : addContact,
		modifyContact : modifyContact,
		subscribe : subscribe,
		unsubscribe : unsubscribe
	}
})());
