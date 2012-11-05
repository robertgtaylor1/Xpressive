// Contact object
function Contact(jid) {
	this.jid = jid;

	Strophe.debug("Contact created for: " + jid)

	this.name = "";
	this.resources = {};
	this.subscription = "none";
	this.ask = "";
	this.groups = [];
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
		this.chatSession = Strophe.chat.chatTo(jid);
	},

	endChat : function() {
		var message = $message({
			to : jid
		}).c("gone", {
			xmlns : Strophe.NS.CHATSTATES
		});

		Strophe.connection.send(message);
	},

	changeName : function(newName) {

	},

	getVCard : function() {

	},

	toString : function() {
		return "jid:" + this.jid + ", name:" + this.name + ", subscription:" + this.subscription + ", groups:" + this.groups.toString();
	}
};

function Contacts() {
	this.list = {};
}

Contacts.prototype = {
	list : {},
	
	// called when roster udpates are received
	rosterChanged : function(iq) {

		var item = $(iq).find('item');
		var jid = item.attr('jid');
		var subscription = item.attr('subscription') || "";

		if (subscription === "remove") {
			// removing contact from roster
			delete this.contacts.list[jid];
		} else if (subscription === "none") {
			// adding contact to roster
			var contact = new Contact(jid);
			contact.name = item.attr('name') || "";
			item.find("group").each(function() {
				contact.groups.push(this.text());
			});
			this.contacts.list[jid] = contact;
		} else {
			// modifying contact on roster
			var contact = this.list[jid];
			contact.name = item.attr('name') || contact.name;
			contact.subscription = subscription || contact.subscription;
			contact.ask = item.attr('ask') || contact.ask;
			contact.groups = [];
			item.find("group").each(function() {
				contact.groups.push(this.text());
			});
		}

		// acknowledge receipt
		this._connection.send($iq({
			type : "result",
			id : $(iq).attr('id')
		}).tree());

		// notify user code of roster changes
		$(document).trigger("roster_changed", _this);

		return true;
	},

	// called when presence stanzas are received
	presenceChanged : function(presence) {
		var from = $(presence).attr("from");
		var jid = Strophe.getBareJidFromJid(from);
		var resource = Strophe.getResourceFromJid(from);
		var ptype = $(presence).attr("type") || $(presence).find("show").text() || "available";

		Strophe.info("presence change for: " + from + " [" + ptype + "]");

		if (!this.contacts.list[jid] || ptype === "error") {
			// ignore presence updates from things not on the roster
			// as well as error presence
			return true;
		}

		if (ptype === "unavailable") {
			// remove resource, contact went offline
			try {
				delete this.contacts.list[jid].resources[resource];
			} catch (e) {
			}
		} else {
			// contact came online or changed status
			this.contacts.list[jid].resources[resource] = {
				show : $(presence).find("show").text() || "online",
				status : $(presence).find("status").text()
			};
		}

		// notify user code of roster changes
		$(document).trigger("presence_changed", this.contacts.list[jid]);

		return true;
	}
}

// example roster plugin
Strophe.addConnectionPlugin('roster', {

	init : function(connection) {
		Strophe.debug("init roster plugin");

		this._connection = connection;
		this.contacts = {};
	},

	// called when connection status is changed
	statusChanged : function(status) {
		var roster_iq, that, contact;
		
		if (status === Strophe.Status.CONNECTED) {
			this.contacts = new Contacts();

			// set up handlers for updates
			this._connection.addHandler(this.contacts.rosterChanged.bind(this), Strophe.NS.ROSTER, "iq", "set");
			this._connection.addHandler(this.contacts.presenceChanged.bind(this), null, "presence");

			// build and send initial roster query
			roster_iq = $iq({
				type : "get"
			}).c('query', {
				xmlns : Strophe.NS.ROSTER
			});

			that = this;
			this._connection.sendIQ(roster_iq, function(iq) {
				Strophe.info("roster_iq received.");

				$(iq).find("item").each(function() {
					// build a new contact and add it to the roster
					contact = new Contact($(this).attr('jid'));
					contact.name = $(this).attr('name') || "";
					contact.subscription = $(this).attr('subscription') || "none";
					contact.ask = $(this).attr('ask') || "";
					$(this).find("group").each(function() {
						contact.groups.push($(this).text());
					});
					// TODO move to prototype
					that.contacts.list[$(this).attr('jid')] = contact;
				});

				// let user code know something happened
				$(document).trigger('roster_changed', that.contacts);
				
				// TODO find a way to fire an event to do this
				that._connection.me.available();
			});
		} else if (status === Strophe.Status.DISCONNECTED) {
			// set all users offline
			// TODO move to prototype
			for (contact in this.contacts.list) {
				this.contacts.list[contact].resources = {};
			}

			// notify user code
			$(document).trigger('roster_changed', this.contacts);
		}
	},
	
	findContact : function(jid) {
		return this.contacts.list[jid] || null;
	},

	// delete a contact from the roster
	deleteContact : function(jid) {
		var iq = $iq({
			type : "set"
		}).c("query", {
			xmlns : Strophe.NS.ROSTER
		}).c("item", {
			jid : jid,
			subscription : "remove"
		});
		this._connection.sendIQ(iq);
	},

	// add a contact to the roster
	addContact : function(jid, name, groups) {
		var iq = $iq({
			type : "set"
		}).c("query", {
			xmlns : Strophe.NS.ROSTER
		}).c("item", {
			name : name || "",
			jid : jid
		});
		if (groups && groups.length > 0) {
			$.each(groups, function() {
				iq.c("group").t(this).up();
			});
		}
		this._connection.sendIQ(iq);
	},

	// modify a roster contact
	modifyContact : function(jid, name, groups) {
		this.addContact(jid, name, groups);
	},

	// subscribe to a new contact's presence
	subscribe : function(jid, name, groups) {
		this.addContact(jid, name, groups);

		var presence = $pres({
			to : jid,
			"type" : "subscribe"
		});
		this._connection.send(presence);
	},

	// unsubscribe from a contact's presence
	unsubscribe : function(jid) {
		var presence = $pres({
			to : jid,
			"type" : "unsubscribe"
		});
		this._connection.send(presence);

		this.deleteContact(jid);
	}
});
